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
let zIndexCounter = 100; // Starting z-index for the first modal

function openPortal(portalItem) {
    if (!portalItem) return;

    // 1. Create a new modal by cloning the template
    const newModal = modalTemplate.cloneNode(true);
    newModal.removeAttribute('id'); // Remove template ID
    newModal.style.zIndex = zIndexCounter++; // Assign and increment z-index for layering

    const modalBody = newModal.querySelector('#main-modal-body');
    const closeButton = newModal.querySelector('.modal-close-btn');
    
    // Clear default content and add the title
    modalBody.innerHTML = `<h2 class="text-3xl font-serif text-amber-300 mb-4">${portalItem.fields.title}</h2>`;

    if (portalItem.fields.portalImage?.fields?.file?.url) {
        const imgHtml = `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full md:w-1/3 h-auto object-contain rounded-lg float-left mr-6 mb-4">`;
        modalBody.insertAdjacentHTML('beforeend', imgHtml);
    }
    if (portalItem.fields.introduction?.content) {
        modalBody.insertAdjacentHTML('beforeend', documentToHtmlString(portalItem.fields.introduction));
    }

    // 2. Separate accordions from grid items
    const subPortals = portalItem.fields.subPortals || [];
    const accordionItems = subPortals.filter(p => p.fields.displayType === 'Accordion');
    const gridItems = subPortals.filter(p => p.fields.displayType !== 'Accordion');

    // 3. Create and append the grid container for modal-type sub-portals
    if (gridItems.length > 0) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'sub-portal-container clear-both grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4';
        gridItems.forEach(item => {
            const portalElement = createPortalElement(item);
            if (portalElement) gridContainer.appendChild(portalElement);
        });
        modalBody.appendChild(gridContainer);
    }
    
    // 4. Create and append the list container for accordion-type sub-portals
    if (accordionItems.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'sub-portal-container clear-both flex flex-col gap-4 mt-4';
        accordionItems.forEach(item => {
            const portalElement = createPortalElement(item);
            if (portalElement) listContainer.appendChild(portalElement);
        });
        modalBody.appendChild(listContainer);
    }
    
    if (portalItem.fields.conclusion?.content) {
        const conclusionHtml = `<div class="clear-both pt-4">${documentToHtmlString(portalItem.fields.conclusion)}</div>`;
        modalBody.insertAdjacentHTML('beforeend', conclusionHtml);
    }

    // 5. Add event listeners for the new modal
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

    // 6. Add the new modal to the page and display it
    modalContainer.appendChild(newModal);
    newModal.style.display = 'flex';
}

function createPortalElement(portalItem) {
    if (!portalItem?.fields?.title) { return null; }

    const portalWrapper = document.createElement('div');
    const isAccordion = portalItem.fields.displayType === 'Accordion';

    const portalButton = document.createElement('div');
    portalButton.className = isAccordion
        ? 'portal-accordion-button group bg-gray-800/70 border border-amber-800/50 rounded-lg p-4 flex items-center text-left cursor-pointer'
        : 'portal-book group aspect-[3/4] bg-gray-800/70 border-2 border-double border-amber-800/50 rounded-lg p-4 flex flex-col justify-center items-center text-center cursor-pointer';

    if (portalItem.fields.portalImage?.fields?.file?.url) {
        const imageElement = document.createElement('img');
        imageElement.src = 'https:' + portalItem.fields.portalImage.fields.file.url;
        imageElement.alt = portalItem.fields.title;
        imageElement.className = isAccordion ? 'w-12 h-12 mr-4 rounded-md object-cover flex-shrink-0' : 'w-16 h-16 mb-2 rounded-full object-cover border-2 border-amber-500/50';
        portalButton.appendChild(imageElement);
    }

    const titleElement = document.createElement('h4');
    titleElement.className = 'font-serif text-amber-200 group-hover:text-white transition-colors';
    titleElement.textContent = portalItem.fields.title;
    portalButton.appendChild(titleElement);
    
    portalWrapper.appendChild(portalButton);
    
    if (isAccordion) {
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
    } else {
        portalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            openPortal(portalItem);
        });
    }

    return portalWrapper;
}

const portalGrid = document.getElementById('portal-grid');
document.getElementById('welcome-area').innerHTML = `<div class="flex flex-col md:flex-row gap-6 lg:gap-8 items-start"><div class="w-full md:w-3/5 lg:w-2/3 text-left bg-stone-200/90 text-gray-800 p-6 rounded-lg shadow-inner border border-stone-400/50"><h2 class="text-3xl lg:text-4xl font-serif text-gray-900">A Storyteller's Welcome</h2><div class="font-caveat text-2xl lg:text-3xl text-gray-800 my-4"><p>Sit with me here beneath the shrine gate where the vines have learned to hum...</p></div><hr class="border-stone-400/50 my-4"><div class="text-gray-700"><h3 class="text-xl font-bold text-gray-800 font-serif mb-2">A Note from the Professor</h3><p class="mb-3">For a more... academic perspective, you may also consult my field notes...</p></div></div><div class="w-full md:w-2/5 lg:w-1/3 mt-6 md:mt-0"><img src="https://i.imgur.com/oAl9hd4.jpeg" class="rounded-lg shadow-xl border-2 border-black/20 w-full h-auto"></div></div>`;

client.getEntries({
    content_type: 'lore',
    'fields.isTopLevel': true,
    include: 10
})
.then((response) => {
    if (!response.items.length) {
        portalGrid.innerHTML = '<p class="col-span-full text-center text-amber-200">No top-level portals found. Make sure at least one is published with "isTopLevel" ON.</p>';
    } else {
        response.items.forEach(item => {
            const portalElement = createPortalElement(item);
            if (portalElement) { portalGrid.appendChild(portalElement); }
        });
    }
})
.catch((error) => {
    console.error(error);
    portalGrid.innerHTML = '<p class="col-span-full text-center text-red-400">Error fetching content. Check console (F12) and API keys.</p>';
});