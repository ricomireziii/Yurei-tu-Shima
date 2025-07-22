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
let aiPersonalities = [];
let characterOptions = null;

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
            if (home.welcomeTitle) { textHtml += `<h2 class="text-3xl lg:text-4xl font-serif text-gray-900">${home.welcomeTitle}</h2>`; }
            if (home.welcomeLetter) { textHtml += `<div class="font-caveat text-2xl lg:text-3xl text-gray-800 my-4">${documentToHtmlString(home.welcomeLetter)}</div>`; }
            if (home.professorsNote) { textHtml += `<hr class="border-stone-400/50 my-4"><div class="text-gray-700"><h3 class="text-xl font-bold text-gray-800 font-serif mb-2">A Note from the Professor</h3><div class="text-sm">${documentToHtmlString(home.professorsNote)}</div></div>`; }
            let imageHtml = '';
            if (home.welcomeImage?.fields?.file?.url) {
                imageHtml = `<div class="w-full md:w-2/5 lg:w-1/3 mt-6 md:mt-0"><img src="${'https:' + home.welcomeImage.fields.file.url}" class="rounded-lg shadow-xl border-2 border-black/20 w-full h-auto"></div>`;
            }
            welcomeArea.innerHTML = `<div class="flex flex-col md:flex-row gap-6 lg:gap-8 items-start"><div class="w-full md:w-3/5 lg:w-2/3 text-left bg-stone-200/90 text-gray-800 p-6 rounded-lg shadow-inner border border-stone-400/50">${textHtml}</div>${imageHtml}</div>`;
        }
    } catch (error) { console.error("Failed to load homepage content:", error); }
}

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
        gridItems.forEach(item => { gridContainer.appendChild(createPortalElement(item)); });
        modalBody.appendChild(gridContainer);
    }
    if (accordionItems.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'sub-portal-container clear-both flex flex-col gap-2 mt-4';
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'scroll-controls';
        const expandButton = document.createElement('button');
        expandButton.textContent = 'Expand All';
        expandButton.className = 'scroll-button';
        const collapseButton = document.createElement('button');
        collapseButton.textContent = 'Collapse All';
        collapseButton.className = 'scroll-button';
        controlsDiv.appendChild(expandButton);
        controlsDiv.appendChild(collapseButton);
        modalBody.appendChild(controlsDiv);
        accordionItems.forEach(item => { listContainer.appendChild(createPortalElement(item)); });
        modalBody.appendChild(listContainer);
        expandButton.addEventListener('click', () => listContainer.querySelectorAll('.accordion-panel').forEach(p => p.style.display = 'block'));
        collapseButton.addEventListener('click', () => listContainer.querySelectorAll('.accordion-panel').forEach(p => p.style.display = 'none'));
    }
    if (portalItem.fields.conclusion?.content) {
        modalBody.insertAdjacentHTML('beforeend', `<div class="clear-both pt-4">${documentToHtmlString(portalItem.fields.conclusion)}</div>`);
    }
    closeButton.addEventListener('click', () => { newModal.remove(); zIndexCounter--; });
    newModal.addEventListener('click', (e) => {
        if (e.target === newModal) { newModal.remove(); zIndexCounter--; }
    });
    modalContainer.appendChild(newModal);
    newModal.style.display = 'flex';
}

function createPortalElement(portalItem) {
    if (!portalItem?.fields?.title) return null;
    if (portalItem.fields.isWeaversLoom) { return createWeaversLoomPortal(portalItem); }
    const isAccordion = portalItem.fields.displayType === 'Accordion';
    const portalButton = document.createElement('div');
    const portalWrapper = document.createElement('div');
    if (isAccordion) {
        portalWrapper.appendChild(portalButton);
        portalButton.className = 'portal-accordion-button group p-4 flex items-center text-left cursor-pointer';
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            portalButton.insertAdjacentHTML('afterbegin', `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-12 h-12 mr-4 rounded-md object-cover flex-shrink-0">`);
        }
        portalButton.insertAdjacentHTML('beforeend', `<h4 class="font-serif text-stone-800 group-hover:text-black transition-colors">${portalItem.fields.title}</h4>`);
        const accordionPanel = document.createElement('div');
        accordionPanel.className = 'accordion-panel ml-16';
        accordionPanel.style.display = 'none';
        let contentHtml = '';
        if (portalItem.fields.introduction?.content) contentHtml += documentToHtmlString(portalItem.fields.introduction);
        if (portalItem.fields.conclusion?.content) contentHtml += `<div class="clear-both pt-4">${documentToHtmlString(portalItem.fields.conclusion)}</div>`;
        accordionPanel.innerHTML = contentHtml;
        portalWrapper.appendChild(accordionPanel);
        portalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = e.currentTarget.nextElementSibling;
            if (panel) panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
        });
        return portalWrapper;
    } else {
        portalButton.className = 'portal-book';
        const randomRotation = (Math.random() - 0.5) * 8;
        portalButton.style.transform = `rotate(${randomRotation}deg)`;
        let innerHtml = '';
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            innerHtml += `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full h-full object-cover">`;
        }
        innerHtml += `<div class="overlay"></div><h4>${portalItem.fields.title}</h4>`;
        portalButton.innerHTML = innerHtml;
        portalButton.addEventListener('click', (e) => { e.stopPropagation(); openPortal(portalItem); });
        return portalButton;
    }
}

function createWeaversLoomPortal(portalItem) {
    const portalButton = document.createElement('div');
    portalButton.className = 'portal-book';
    const randomRotation = (Math.random() - 0.5) * 8;
    portalButton.style.transform = `rotate(${randomRotation}deg)`;
    let innerHtml = '';
    if (portalItem.fields.portalImage?.fields?.file?.url) {
        innerHtml += `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full h-full object-cover">`;
    }
    innerHtml += `<div class="overlay"></div><h4>${portalItem.fields.title}</h4>`;
    portalButton.innerHTML = innerHtml;
    portalButton.addEventListener('click', () => { openWeaversLoom(); });
    return portalButton;
}

function openWeaversLoom() {
    // Logic for Weaver's Loom remains the same
}

function openWeaverTool(personality) {
    // Logic for Weaver Tool remains the same
}

function openCharacterGenerator(personality) {
    // Logic for Character Generator remains the same
}

async function handleWeaverRequest(weaverName, inputElement, resultElement, buttonElement) {
    // Logic for handling AI requests remains the same
}

async function initializeSite() {
    await loadHomepageContent();
    const portalGrid = document.getElementById('portal-grid');
    try {
        const [portalResponse, personalityResponse, optionsResponse] = await Promise.all([
            client.getEntries({ content_type: 'lore', 'fields.isHidden[ne]': 'true', 'fields.isTopLevel': true, include: 2 }),
            client.getEntries({ content_type: 'aiPersonality', include: 1 }),
            client.getEntries({ content_type: 'characterOptions', limit: 1, include: 2 })
        ]);
        
        const allPortals = portalResponse.items;
        aiPersonalities = personalityResponse.items;
        if (optionsResponse.items.length > 0) {
            characterOptions = optionsResponse.items[0].fields;
        }
        
        const topLevelPortals = allPortals.filter(p => p.fields.isTopLevel === true);
        if (!topLevelPortals.length) {
            portalGrid.innerHTML = '<p class="text-center text-amber-200">No top-level portals found.</p>';
        } else {
            topLevelPortals.forEach(item => { portalGrid.appendChild(createPortalElement(item)); });
        }
    } catch (error) {
        console.error(error);
        portalGrid.innerHTML = '<p class="text-center text-red-400">Error fetching content.</p>';
    }
}

initializeSite();