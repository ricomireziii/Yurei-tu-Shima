import os
import re
import yaml
import json
import google.generativeai as genai
import time
import shutil
from io import StringIO # NEW: Needed to build string in memory

# --- CONFIGURATION ---
INPUT_FILENAME = 'lore-export.json'
OUTPUT_FOLDER = 'Canon_Files'
CACHE_FILENAME = 'ai_cache.json'
CATEGORY_FIELD_ID = 'category'
# --- END OF CONFIGURATION ---

# --- SETUP YOUR API KEY ---
try:
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    print("Successfully configured Gemini API.")
except Exception as e:
    print(f"ERROR: Could not configure the Gemini API. Please ensure you have set your GOOGLE_API_KEY environment variable.")
    print(f"Details: {e}")
    exit()
# --- END OF SETUP ---

# --- UTILITY FUNCTIONS ---
ILLEGAL_CHARS_RE = re.compile(r'[<>:"/\\|?*]')

def get_field_value(fields_dict, field_id):
    field_data = fields_dict.get(field_id)
    if isinstance(field_data, dict) and 'en-US' in field_data:
        return field_data.get('en-US')
    return field_data if isinstance(field_data, (str, bool, int, float, list)) else None

def generate_slug(title):
    if not title or not isinstance(title, str):
        return ''
    slug = title.lower()
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    return slug.strip('-')

def parse_rich_text(node):
    content_text = ""
    if isinstance(node, dict) and 'nodeType' in node:
        if 'content' in node and isinstance(node['content'], list):
            for sub_node in node['content']:
                content_text += parse_rich_text(sub_node)
        if node['nodeType'] == 'paragraph' and content_text.strip():
            return content_text + "\n\n"
        elif node['nodeType'] == 'text' and 'value' in node:
            return node['value']
    return content_text

def sanitize_name(name):
    if not isinstance(name, str):
        name = str(name)
    name = ILLEGAL_CHARS_RE.sub('', name).strip()
    return name if name not in ['.', '..'] else 'unnamed_entry'

def load_cache():
    if os.path.exists(CACHE_FILENAME):
        try:
            with open(CACHE_FILENAME, 'r', encoding='utf-8') as f:
                print(f"Loading AI cache from {CACHE_FILENAME}...")
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load cache file. A new one will be created. Error: {e}")
    return {}

def save_cache(cache_data):
    try:
        with open(CACHE_FILENAME, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)
        print(f"AI cache saved to {CACHE_FILENAME}.")
    except IOError as e:
        print(f"Error: Could not save cache file. Error: {e}")

def call_gemini_api(prompt, title, task_name="task"):
    try:
        print(f" > AI Task: '{title}' ({task_name})...")
        response = model.generate_content(prompt)
        time.sleep(1)
        return response.text.strip()
    except Exception as e:
        print(f" > ERROR during {task_name} for '{title}': {e}")
        return None

def create_ai_capsule_prompt(title, introduction, conclusion, category_path, is_portal, is_leaf, mechanical_equivalent):
    kind = "portal" if is_portal else "leaf" if is_leaf else "conclusion"
    parents = [generate_slug(p) for p in category_path.replace('\\', '/').split('/') if p]
    slug = generate_slug(title)
    full_id_path = parents + [slug]
    entry_id = "/".join(full_id_path)
    combined_text_for_extraction = introduction + "\n\n" + conclusion

    prompt = f"""
    Create a YAML "ai-gm" capsule based on the structured data provided below.
    Extract the required lists (regions, kinships, etc.) from the combined narrative text.

    **Structured Data:**
    - **id**: `{entry_id}`
    - **kind**: `{kind}`
    - **parents**: `{json.dumps(parents)}`
    - **slug**: `{slug}`
    - **index**: `{'true' if is_leaf else 'false'}`
    - **mech**: `"{mechanical_equivalent}"` (use this exact value if not empty)

    **Narrative Text for Extraction:**
    ---
    {combined_text_for_extraction}
    ---

    **Extraction Instructions:**
    From the "Narrative Text for Extraction," find the following. If a field is not present, omit it from the final YAML.
    1.  **regions**: A list of all mentioned regions, converted to kebab-case slugs.
    2.  **kinships**: A list of all mentioned kinships, converted to kebab-case slugs.
    3.  **etiquette**: A list of specific, actionable rules of social etiquette.
    4.  **npcs**: A list of any named NPCs with a brief descriptor (e.g., "Ri’ka — map-mender").
    5.  **hooks**: A list of 1-2 compelling, one-line story hooks for a GM.

    **Final Output Format:**
    - Output MUST be a single YAML code block labeled `ai-gm`.
    - Do not include any other text, explanation, or markdown formatting.
    """
    return prompt

def process_entry(entry_id, all_entries, cache):
    entry_data = all_entries.get(entry_id)
    if not entry_data: return

    fields = entry_data.get('fields', {})
    title = get_field_value(fields, 'title')
    if not title: return

    introduction_node = get_field_value(fields, 'introduction')
    conclusion_node = get_field_value(fields, 'conclusion')
    introduction = parse_rich_text(introduction_node) if introduction_node else ""
    conclusion = parse_rich_text(conclusion_node) if conclusion_node else ""

    sub_portals = get_field_value(fields, 'subPortals')
    is_portal = bool(sub_portals)
    is_leaf = not is_portal and introduction.strip()

    cat_path_raw = get_field_value(fields, CATEGORY_FIELD_ID) or ""
    
    yaml_data = {'title': title}
    slug = generate_slug(title)
    if slug: yaml_data['slug'] = slug
    
    mechanical_equivalent = get_field_value(fields, 'mechanicalEquivalent') or ""
    if mechanical_equivalent: yaml_data['mechanics'] = mechanical_equivalent
    
    sort_order = get_field_value(fields, 'sortOrder')
    if sort_order is not None: yaml_data['sortOrder'] = sort_order

    ai_capsule = None
    if entry_id in cache:
        print(f" > Using cached AI Capsule for '{title}'.")
        ai_capsule = cache[entry_id]
    else:
        ai_capsule_prompt = create_ai_capsule_prompt(
            title, introduction, conclusion, cat_path_raw, is_portal, is_leaf, mechanical_equivalent
        )
        ai_capsule = call_gemini_api(ai_capsule_prompt, title, "Generate AI Capsule")
        if ai_capsule:
            cache[entry_id] = ai_capsule
    
    # --- Build File Content in Memory ---
    # NEW: All file parts are added to a list instead of being written directly.
    output_parts = []
    
    # 1. Front Matter
    output_parts.append('---\n')
    yaml_stream = StringIO()
    yaml.dump(yaml_data, yaml_stream, default_flow_style=False, sort_keys=False, allow_unicode=True)
    output_parts.append(yaml_stream.getvalue())
    output_parts.append('---\n')

    # 2. Session Index Placeholder (if portal)
    if is_portal:
        output_parts.append("\n\n")
        output_parts.append("\n")
        output_parts.append("\n")

    # 3. Main Title and AI Capsule
    output_parts.append(f"\n# {title}\n")
    if ai_capsule:
        output_parts.append(f"\n{ai_capsule}\n")

    # 4. Narrative Content
    output_parts.append(f"\n{introduction.strip()}\n")
    if conclusion:
        output_parts.append(f"\n### Conclusion\n\n{conclusion.strip()}\n")
    
    # --- Final Cleanup and Write ---
    # NEW: Combine all parts into a single string
    final_content = "".join(output_parts)
    
    # NEW: Use regex to replace any sequence of 3 or more newlines with exactly 2.
    # This enforces the "max one blank line" rule throughout the entire file.
    cleaned_content = re.sub(r'\n{3,}', '\n\n', final_content).strip()
    
    # Get path and write the cleaned content
    normalized_path = cat_path_raw.replace('\\', '/')
    sanitized_path_parts = [sanitize_name(part) for part in normalized_path.split('/') if part]
    category_path = os.path.join(*sanitized_path_parts) if sanitized_path_parts else ''
    full_directory_path = os.path.join(OUTPUT_FOLDER, category_path)
    os.makedirs(full_directory_path, exist_ok=True)
    
    safe_filename = sanitize_name(title).replace(' ', '_') + '.md'
    output_filepath = os.path.join(full_directory_path, safe_filename)

    with open(output_filepath, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)

    print(f"  -> Wrote: {output_filepath}")

def main():
    if os.path.exists(OUTPUT_FOLDER):
        shutil.rmtree(OUTPUT_FOLDER)
        print(f"Cleared output folder: {OUTPUT_FOLDER}")
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    try:
        with open(INPUT_FILENAME, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"ERROR: Could not load or parse '{INPUT_FILENAME}'. Details: {e}")
        return

    cache = load_cache()
    all_entries = {entry['sys']['id']: entry for entry in data.get('entries', [])}
    entry_ids = list(all_entries.keys())
    total_entries = len(entry_ids)

    for i, entry_id in enumerate(entry_ids):
        print(f"\n--- Processing entry {i+1}/{total_entries} ({entry_id}) ---")
        process_entry(entry_id, all_entries, cache)

    save_cache(cache)

if __name__ == "__main__":
    main()