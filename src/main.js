import * as contentful from 'contentful';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

const CSL_SPACE_ID = 'wvafujdu1t0o';
const CSL_ACCESS_TOKEN = 'oZfQWxr-xSXvptXlFgAwJfhcmjYBp_xzmZM7-b5IaaU';

const client = contentful.createClient({
    space: CSL_SPACE_ID,
    accessToken: CSL_ACCESS_TOKEN,
});

const modalContainer = document.getElementById('modal-container');
const modalTemplate = document.getElementById('modal-template');
let zIndexCounter = 100;

// --- Homepage Content ---
async function loadHomepageContent() {
    try {
        const response = await client.getEntries({ content_type: 'homepage', limit: 1 });
        if (response.items.length > 0) {
            const home = response.items[0].fields;
            if (home.backgroundImage?.fields?.file?.url) {
                document.getElementById('app-container').querySelector('img').src = 'https:' + home.backgroundImage.fields.file.url;
            }
            const welcomeArea = document.getElementById('welcome-area');
            let textHtml = '';
            if (home.welcomeTitle) {
                textHtml += `<h2 class="text-3xl lg:text-4xl font-serif text-gray-900">${home.welcomeTitle}</h2>`;
            }
            if (home.welcomeLetter) {
                textHtml += `<div class="font-caveat text-2xl lg:text-3xl text-gray-800 my-4">${documentToHtmlString(home.welcomeLetter)}</div>`;
            }
            if (home.professorsNote) {
                textHtml += `<hr class="border-stone-400/50 my-4"><div class="text-gray-700"><h3 class="text-xl font-bold text-gray-800 font-serif mb-2">A Note from the Professor</h3><div class="text-sm">${documentToHtmlString(home.professorsNote)}</div></div>`;
            }
            let imageHtml = '';
            if (home.welcomeImage?.fields?.file?.url) {
                imageHtml = `<div class="w-full md:w-2/5 lg:w-1/3 mt-6 md:mt-0"><img src="${'https:' + home.welcomeImage.fields.file.url}" class="rounded-lg shadow-xl border-2 border-black/20 w-full h-auto"></div>`;
            }
            welcomeArea.innerHTML = `<div class="flex flex-col md:flex-row gap-6 lg:gap-8 items-start"><div class="w-full md:w-3/5 lg:w-2/3 text-left bg-stone-200/90 text-gray-800 p-6 rounded-lg shadow-inner border border-stone-400/50">${textHtml}</div>${imageHtml}</div>`;
        }
    } catch (error) {
        console.error("Failed to load homepage content:", error);
    }
}

// --- Modal and Portal Logic ---
function openPortal(portalItem) {
    if (!portalItem) return;
    const newModal = modalTemplate.cloneNode(true);
    newModal.removeAttribute('id');
    newModal.style.zIndex = zIndexCounter++;
    const modalBody = newModal.querySelector('#main-modal-body');
    const closeButton = newModal.querySelector('.modal-close-btn');
    modalBody.innerHTML = `<h2 class="text-3xl font-serif text-amber-300 mb-4">${portalItem.fields.title}</h2>`;
    if (portalItem.fields.portalImage?.fields?.file?.url) {
        modalBody.insertAdjacentHTML('beforeend', `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full md:w-1/3 h-auto object-contain rounded-lg float-left mr-6 mb-4">`);
    }
    if (portalItem.fields.introduction?.content) {
        modalBody.insertAdjacentHTML('beforeend', documentToHtmlString(portalItem.fields.introduction));
    }
    const subPortals = portalItem.fields.subPortals || [];
    const accordionItems = subPortals.filter(p => p.fields.displayType === 'Accordion');
    const gridItems = subPortals.filter(p => p.fields.displayType !== 'Accordion');
    if (gridItems.length > 0) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'portal-container clear-both';
        gridItems.forEach(item => {
            const portalElement = createPortalElement(item);
            if (portalElement) gridContainer.appendChild(portalElement);
        });
        modalBody.appendChild(gridContainer);
    }
    if (accordionItems.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'sub-portal-container clear-both flex flex-col gap-2 mt-4';
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'scroll-controls';
        const expandButton = document.createElement('button');
        expandButton.className = 'scroll-button';
        expandButton.textContent = 'Expand All';
        const collapseButton = document.createElement('button');
        collapseButton.className = 'scroll-button';
        collapseButton.textContent = 'Collapse All';
        controlsDiv.appendChild(expandButton);
        controlsDiv.appendChild(collapseButton);
        modalBody.appendChild(controlsDiv);
        accordionItems.forEach(item => {
            const portalElement = createPortalElement(item);
            if (portalElement) listContainer.appendChild(portalElement);
        });
        modalBody.appendChild(listContainer);
        expandButton.addEventListener('click', () => {
            listContainer.querySelectorAll('.accordion-panel').forEach(panel => { panel.style.display = 'block'; });
        });
        collapseButton.addEventListener('click', () => {
            listContainer.querySelectorAll('.accordion-panel').forEach(panel => { panel.style.display = 'none'; });
        });
    }
    if (portalItem.fields.conclusion?.content) {
        modalBody.insertAdjacentHTML('beforeend', `<div class="clear-both pt-4">${documentToHtmlString(portalItem.fields.conclusion)}</div>`);
    }
    closeButton.addEventListener('click', () => {
        newModal.remove();
        zIndexCounter--;
    });
    newModal.addEventListener('click', (e) => {
        if (e.target === newModal) {
            newModal.remove();
            zIndexCounter--;
        }
    });
    modalContainer.appendChild(newModal);
    newModal.style.display = 'flex';
}

function createPortalElement(portalItem) {
    if (!portalItem?.fields?.title) { return null; }
    const isAccordion = portalItem.fields.displayType === 'Accordion';
    const portalButton = document.createElement('div');
    if (isAccordion) {
        const portalWrapper = document.createElement('div');
        portalWrapper.appendChild(portalButton);
        portalButton.className = 'portal-accordion-button group p-4 flex items-center text-left cursor-pointer';
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            const imageElement = document.createElement('img');
            imageElement.src = 'https:' + portalItem.fields.portalImage.fields.file.url;
            imageElement.alt = portalItem.fields.title;
            imageElement.className = 'w-12 h-12 mr-4 rounded-md object-cover flex-shrink-0';
            portalButton.appendChild(imageElement);
        }
        const titleElement = document.createElement('h4');
        titleElement.className = 'font-serif text-stone-800 group-hover:text-black transition-colors';
        titleElement.textContent = portalItem.fields.title;
        portalButton.appendChild(titleElement);
        const accordionPanel = document.createElement('div');
        accordionPanel.className = 'accordion-panel ml-16';
        accordionPanel.style.display = 'none';
        let contentHtml = '';
        if (portalItem.fields.introduction?.content) {
            contentHtml += documentToHtmlString(portalItem.fields.introduction);
        }
        if (portalItem.fields.conclusion?.content) {
            contentHtml += `<div class="clear-both pt-4">${documentToHtmlString(portalItem.fields.conclusion)}</div>`;
        }
        accordionPanel.innerHTML = contentHtml;
        portalWrapper.appendChild(accordionPanel);
        portalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = e.currentTarget.nextElementSibling;
            if (panel) {
                panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
            }
        });
        return portalWrapper;
    } else {
        portalButton.className = 'portal-book';
        const randomRotation = (Math.random() - 0.5) * 8;
        const randomX = (Math.random() - 0.5) * 10;
        const randomY = (Math.random() - 0.5) * 10;
        portalButton.style.transform = `rotate(${randomRotation}deg) translate(${randomX}px, ${randomY}px)`;
        let innerHtml = '';
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            innerHtml += `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full h-full object-cover">`;
        }
        innerHtml += `<div class="overlay"></div><h4>${portalItem.fields.title}</h4>`;
        portalButton.innerHTML = innerHtml;
        portalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            openPortal(portalItem);
        });
        return portalButton;
    }
}

// --- NEW: Weaver's Loom Logic ---
async function handleWeaverRequest(weaverName, inputId, resultId, buttonId) {
    const inputElement = document.getElementById(inputId);
    const resultElement = document.getElementById(resultId);
    const buttonElement = document.getElementById(buttonId);
    const prompt = inputElement.value;

    if (!prompt) return;

    resultElement.parentElement.style.display = 'block';
    resultElement.innerHTML = `<p class="text-amber-300 italic">The loom hums as threads gather...</p>`;
    buttonElement.disabled = true;

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, weaverName }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        resultElement.innerHTML = data.text.replace(/\n/g, '<br>');

    } catch (error) {
        console.error('Error:', error);
        resultElement.innerHTML = `<p class="text-red-400">The threads snapped... (Error: ${error.message}).</p>`;
    } finally {
        buttonElement.disabled = false;
    }
}

// Function to set up event listeners for the Weaver's Loom
function initializeWeaversLoom() {
    document.getElementById('thread-weave-btn').addEventListener('click', () => handleWeaverRequest('Thread Weaver', 'thread-input', 'thread-result', 'thread-weave-btn'));
    document.getElementById('ink-weave-btn').addEventListener('click', () => handleWeaverRequest('Ink Weaver', 'ink-input', 'ink-result', 'ink-weave-btn'));
    document.getElementById('whisper-weave-btn').addEventListener('click', () => handleWeaverRequest('Whisper Weaver', 'whisper-input', 'whisper-result', 'whisper-weave-btn'));
    
    // Add logic for copy button if it exists
    const copyBtn = document.querySelector('#ink-result-wrapper .copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', e => {
            const textToCopy = e.target.parentElement.querySelector('#ink-result').innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                e.target.textContent = 'Copied!';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
            });
        });
    }
}


// --- Site Initialization ---
async function initializeSite() {
    await loadHomepageContent();
    const portalGrid = document.getElementById('portal-grid');
    portalGrid.className = 'portal-container';
    try {
        const response = await client.getEntries({
            content_type: 'lore',
            'fields.isTopLevel': true,
            include: 10
        });
        if (!response.items.length) {
            portalGrid.innerHTML = '<p class="text-center text-amber-200">No top-level portals found. Make sure at least one is published with "isTopLevel" ON.</p>';
        } else {
            response.items.forEach(item => {
                const portalElement = createPortalElement(item);
                if (portalElement) { portalGrid.appendChild(portalElement); }
            });
        }
    } catch (error) {
        console.error(error);
        portalGrid.innerHTML = '<p class="text-center text-red-400">Error fetching content. Check console (F12) and API keys.</p>';
    }
    
    // Initialize the AI tools
    initializeWeaversLoom();
}

initializeSite();