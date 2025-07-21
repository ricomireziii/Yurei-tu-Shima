import * as contentful from 'contentful';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

const CSL_SPACE_ID = 'wvafujdu1t0o';
const CSL_ACCESS_TOKEN = 'oZfQWxr-xSXvptXlFgAwJfhcmjYBp_xzmZM7-b5IaaU';

const client = contentful.createClient({
    space: CSL_SPACE_ID,
    accessToken: CSL_ACCESS_TOKEN,
});

const mainModal = document.getElementById('main-modal');
const mainModalBody = document.getElementById('main-modal-body');
const allCloseButtons = document.querySelectorAll('.modal-close-btn');

function openModal(contentHtml) {
    mainModalBody.innerHTML = contentHtml;
    mainModal.style.display = 'flex';
}

allCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => { btn.closest('.modal').style.display = 'none'; });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) { e.target.style.display = 'none'; }
});

function createPortalElement(portalItem) {
    if (!portalItem?.fields?.title) { return null; }

    const portalWrapper = document.createElement('div');
    portalWrapper.className = 'portal-wrapper';
    const portalButton = document.createElement('div');
    portalButton.className = 'portal-book group aspect-[3/4] bg-gray-800/70 border-2 border-double border-amber-800/50 rounded-lg p-4 flex flex-col justify-center items-center text-center cursor-pointer';

    if (portalItem.fields.portalImage?.fields?.file?.url) {
        const imageElement = document.createElement('img');
        imageElement.src = 'https:' + portalItem.fields.portalImage.fields.file.url;
        imageElement.alt = portalItem.fields.title;
        imageElement.className = 'w-16 h-16 mb-2 rounded-full object-cover border-2 border-amber-500/50';
        portalButton.appendChild(imageElement);
    } else {
        portalButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mb-2 text-amber-300/70 group-hover:text-amber-200" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>`;
    }

    const titleElement = document.createElement('h4');
    titleElement.className = 'font-serif text-amber-200 group-hover:text-white transition-colors';
    titleElement.textContent = portalItem.fields.title;
    portalButton.appendChild(titleElement);
    portalWrapper.appendChild(portalButton);

    const displayType = portalItem.fields.displayType || 'Modal';

    let contentHtml = '';
    if (portalItem.fields.portalImage?.fields?.file?.url) {
        contentHtml += `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full md:w-1/3 h-auto object-contain rounded-lg float-left mr-6 mb-4">`;
    }
    
    if (portalItem.fields.introduction && portalItem.fields.introduction.content && portalItem.fields.introduction.content.length > 0) {
        contentHtml += documentToHtmlString(portalItem.fields.introduction);
    }
    
    contentHtml += `<div class="sub-portal-container clear-both">`;
    if (portalItem.fields.subPortals?.length > 0) {
        portalItem.fields.subPortals.forEach(subPortal => {
            const subPortalElement = createPortalElement(subPortal);
            if (subPortalElement) { contentHtml += subPortalElement.outerHTML; }
        });
    }
    contentHtml += `</div>`;
    
    if (portalItem.fields.conclusion && portalItem.fields.conclusion.content && portalItem.fields.conclusion.content.length > 0) {
        contentHtml += `<div class="clear-both">${documentToHtmlString(portalItem.fields.conclusion)}</div>`;
    }

    if (displayType === 'Accordion') {
        const accordionPanel = document.createElement('div');
        accordionPanel.className = 'accordion-panel';
        accordionPanel.innerHTML = contentHtml;
        accordionPanel.style.display = 'none';
        portalWrapper.appendChild(accordionPanel);

        portalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = e.currentTarget.nextElementSibling;
            if (panel) { panel.style.display = (panel.style.display === 'none') ? 'block' : 'none'; }
        });
    } else {
        portalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const modalContentHtml = `<h2 class="text-3xl font-serif text-amber-300 mb-4">${portalItem.fields.title}</h2>${contentHtml}`;
            openModal(modalContentHtml);
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