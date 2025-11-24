import os
import re
import yaml
import shutil

# --- CONFIGURATION ---
SOURCE_FOLDER = 'Canon_Files'
DESTINATION_FOLDER = 'GEM_FILES'
# If a portal/introduction file's content is shorter than this, it will be skipped
# in the final consolidated output to reduce clutter.
LORE_THRESHOLD = 50 
# --- END OF CONFIGURATION ---

def get_yaml_and_content(file_path):
    """Safely reads an .md file, separating YAML front matter from the main content."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.match(r'---\s*(.*?)\s*---\s*(.*)', content, re.DOTALL)
            if match:
                yaml_data = yaml.safe_load(match.group(1))
                main_content = match.group(2).strip()
                return yaml_data, main_content
    except (IOError, yaml.YAMLError): pass
    return {}, ""

def build_tree(directory):
    """Builds a data structure of the hierarchy based on the filesystem."""
    tree = []
    
    # Use a dictionary to group files by their sort order and title
    nodes_to_sort = []
    
    # List all items in the directory
    try:
        items = os.listdir(directory)
    except FileNotFoundError:
        return []

    for item_name in items:
        if item_name.endswith('.md'):
            item_path = os.path.join(directory, item_name)
            yaml_data, _ = get_yaml_and_content(item_path)
            
            sort_order = yaml_data.get('sortOrder')
            # Handle NoneType for sort order
            sort_key = 999 if sort_order is None else sort_order
            title_key = yaml_data.get('title', item_name)

            node = {'path': item_path, 'sort_key': (sort_key, title_key)}
            
            dir_equivalent_name = item_name[:-3].replace('_', ' ')
            dir_path = os.path.join(directory, dir_equivalent_name)
            
            if os.path.isdir(dir_path):
                node['type'] = 'parent'
                node['children'] = build_tree(dir_path)
            else:
                node['type'] = 'leaf'
            nodes_to_sort.append(node)
            
    # Sort the nodes based on the sort_key (sortOrder, then title)
    tree = sorted(nodes_to_sort, key=lambda x: x['sort_key'])
    return tree

def write_toc_from_tree(tree, file_handle, depth=0):
    """Recursively writes a Table of Contents from the pre-built tree structure."""
    indent = '  ' * depth
    for node in tree:
        yaml_data, content = get_yaml_and_content(node['path'])
        is_portal = node.get('type') == 'parent'
        
        if is_portal and len(content) < LORE_THRESHOLD:
            write_toc_from_tree(node.get('children', []), file_handle, depth)
            continue

        title = yaml_data.get('title', 'Untitled')
        slug = yaml_data.get('slug', '')
        if slug:
            file_handle.write(f"{indent}* [{title}](#{slug})\n")
        
        if node.get('type') == 'parent':
            write_toc_from_tree(node.get('children', []), file_handle, depth + 1)

def write_content_from_tree(tree, file_handle, depth=2):
    """Recursively writes the content sections from the pre-built tree structure."""
    heading = '#' * depth
    for node in tree:
        yaml_data, main_content = get_yaml_and_content(node['path'])
        is_portal = node.get('type') == 'parent'

        if is_portal and len(main_content) < LORE_THRESHOLD:
            write_content_from_tree(node.get('children', []), file_handle, depth)
            continue

        title, slug = yaml_data.get('title', 'Untitled'), yaml_data.get('slug', '')
        
        if slug: file_handle.write(f"<a name=\"{slug}\"></a>\n")
        file_handle.write(f"{heading} {title}\n\n")
        if yaml_data: file_handle.write(f"---\n{yaml.dump(yaml_data, sort_keys=False, allow_unicode=True)}---\n\n")
        
        if main_content:
            file_handle.write(re.sub(r'\n{3,}', '\n\n', main_content.strip()) + "\n\n")
            
        if node.get('type') == 'parent':
            write_content_from_tree(node.get('children', []), file_handle, depth + 1)

# --- Main Execution ---
print(f"--- Starting Definitive Consolidator ---")
if os.path.exists(DESTINATION_FOLDER): shutil.rmtree(DESTINATION_FOLDER)
os.makedirs(DESTINATION_FOLDER)

# Identify top-level .md files that have a corresponding directory
top_level_files = []
for file_name in os.listdir(SOURCE_FOLDER):
    if file_name.endswith('.md'):
        dir_equivalent_name = file_name[:-3].replace('_', ' ')
        if os.path.isdir(os.path.join(SOURCE_FOLDER, dir_equivalent_name)):
            top_level_files.append(file_name)

# Sort the top-level files based on their own sortOrder
top_level_files_data = []
for file_name in top_level_files:
    yaml_data, _ = get_yaml_and_content(os.path.join(SOURCE_FOLDER, file_name))
    sort_order = yaml_data.get('sortOrder')
    sort_key = 999 if sort_order is None else sort_order
    title_key = yaml_data.get('title', file_name)
    top_level_files_data.append({'file_name': file_name, 'sort_key': (sort_key, title_key)})

sorted_top_level_files = [data['file_name'] for data in sorted(top_level_files_data, key=lambda x: x['sort_key'])]

for file_name in sorted_top_level_files:
    top_level_md_path = os.path.join(SOURCE_FOLDER, file_name)
    dir_equivalent_name = file_name[:-3].replace('_', ' ')
    dir_equivalent_path = os.path.join(SOURCE_FOLDER, dir_equivalent_name)
    
    print(f"Consolidating category: {dir_equivalent_name}...")
    
    directory_tree = build_tree(dir_equivalent_path)
    
    top_level_yaml, top_level_content = get_yaml_and_content(top_level_md_path)
    top_level_title = top_level_yaml.get('title', dir_equivalent_name)
    top_level_slug = top_level_yaml.get('slug', '')

    final_filename = os.path.join(DESTINATION_FOLDER, file_name)
    with open(final_filename, 'w', encoding='utf-8') as f:
        f.write(f"# {top_level_title}\n\n## Table of Contents\n\n")
        if top_level_slug:
            f.write(f"* [{top_level_title} (Introduction)](#{top_level_slug})\n")
        write_toc_from_tree(directory_tree, f)
        f.write('\n---\n\n')

        if top_level_slug: f.write(f"<a name=\"{top_level_slug}\"></a>\n")
        if top_level_yaml: f.write(f"---\n{yaml.dump(top_level_yaml, sort_keys=False, allow_unicode=True)}---\n\n")
        if top_level_content:
            f.write(re.sub(r'\n{3,}', '\n\n', top_level_content.strip()) + "\n\n")
        
        write_content_from_tree(directory_tree, f)
        
    print(f"  -> Created consolidated file: {final_filename}")

print("\n--- Consolidation Complete ---")