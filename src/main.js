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
const ADMIN_PASSWORD = "yurei";
let isAdminUnlocked = false;

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
                imageHtml = `<div class="w-full mt-6"><img src="${'https:' + home.welcomeImage.fields.file.url}" class="rounded-lg shadow-xl border-2 border-black/20 w-full h-auto"></div>`;
            }
            welcomeArea.innerHTML = `<div class="flex flex-col gap-6 lg:gap-8 items-center"><div class="w-full md:w-3/5 lg:w-2/3 text-left bg-stone-200/90 text-gray-800 p-6 rounded-lg shadow-inner border border-stone-400/50">${textHtml}</div>${imageHtml}</div>`;
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
    const modalContent = newModal.querySelector('.modal-content');

    const hasText = (portalItem.fields.introduction?.content) || (portalItem.fields.conclusion?.content);

    if (portalItem.fields.portalImage?.fields?.file?.url && !hasText) {
        modalBody.innerHTML = `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full h-full object-contain">`;
        modalContent.style.background = 'none';
        modalContent.style.boxShadow = 'none';
    } else {
        modalContent.style.background = '';
        modalContent.style.boxShadow = '';
        modalBody.innerHTML = `<h2 class="text-3xl font-serif text-amber-300 mb-4">${portalItem.fields.title}</h2>`;
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            modalBody.insertAdjacentHTML('beforeend', `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full h-auto object-contain rounded-lg mb-4">`);
        }
        if (portalItem.fields.introduction?.content) {
            modalBody.insertAdjacentHTML('beforeend', documentToHtmlString(portalItem.fields.introduction));
        }
        const subPortals = (portalItem.fields.subPortals || []).filter(Boolean);
        const accordionItems = subPortals.filter(p => p.fields.displayType === 'Accordion');
        const gridItems = subPortals.filter(p => p.fields.displayType !== 'Accordion');
        if (gridItems.length > 0) {
            const gridContainer = document.createElement('div');
            gridContainer.className = 'portal-container clear-both';
            gridItems.forEach(item => { gridContainer.appendChild(createGenericElement(item)); });
            modalBody.appendChild(gridContainer);
        }
        if (accordionItems.length > 0) {
            const listContainer = document.createElement('div');
            listContainer.className = 'sub-portal-container clear-both flex flex-col gap-2 mt-4';
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'scroll-controls';
            const expandButton = document.createElement('button');
            expandButton.textContent = 'Unfurl All';
            expandButton.className = 'scroll-button';
            const collapseButton = document.createElement('button');
            collapseButton.textContent = 'Furl All';
            collapseButton.className = 'scroll-button';
            controlsDiv.appendChild(expandButton);
            controlsDiv.appendChild(collapseButton);
            modalBody.appendChild(controlsDiv);
            accordionItems.forEach(item => { listContainer.appendChild(createGenericElement(item)); });
            modalBody.appendChild(listContainer);
            expandButton.addEventListener('click', () => listContainer.querySelectorAll('.accordion-panel').forEach(p => p.style.display = 'block'));
            collapseButton.addEventListener('click', () => listContainer.querySelectorAll('.accordion-panel').forEach(p => p.style.display = 'none'));
        }
        if (portalItem.fields.conclusion?.content) {
            modalBody.insertAdjacentHTML('beforeend', `<div class="clear-both pt-4">${documentToHtmlString(portalItem.fields.conclusion)}</div>`);
        }
    }

    closeButton.addEventListener('click', () => { newModal.remove(); zIndexCounter--; });
    newModal.addEventListener('click', (e) => {
        if (e.target === newModal) { newModal.remove(); zIndexCounter--; }
    });
    modalContainer.appendChild(newModal);
    newModal.style.display = 'flex';
}

function createGenericElement(item) {
    if (!item || !item.sys || !item.fields) return null;
    const contentType = item.sys.contentType.sys.id;
    if (contentType === 'lore') {
        return createPortalElement(item);
    }
    if (contentType === 'aiPersonality') {
        return createWeaverCard(item);
    }
    return null;
}

function createPortalElement(portalItem) {
    if (!portalItem?.fields?.title) return null;
    
    const portalButton = document.createElement('div');
    const isAccordion = portalItem.fields.displayType === 'Accordion';

    if (isAccordion) {
        const portalWrapper = document.createElement('div');
        portalWrapper.appendChild(portalButton);
        portalButton.className = 'portal-accordion-button group p-4 flex items-center text-left cursor-pointer';
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            portalButton.insertAdjacentHTML('afterbegin', `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-12 h-12 mr-4 rounded-md object-cover flex-shrink-0">`);
        }
        portalButton.insertAdjacentHTML('beforeend', `<h4 class="font-serif text-stone-800 group-hover:text-black transition-colors">${portalItem.fields.title}</h4>`);
        const accordionPanel = document.createElement('div');
        accordionPanel.className = 'accordion-panel ml-16 text-stone-800';
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
        if (portalItem.fields.isHidden) {
            portalButton.classList.add('locked-portal');
        }
        const randomRotation = (Math.random() - 0.5) * 8;
        portalButton.style.transform = `rotate(${randomRotation}deg)`;
        let innerHtml = '';
        if (portalItem.fields.portalImage?.fields?.file?.url) {
            innerHtml += `<img src="${'https:' + portalItem.fields.portalImage.fields.file.url}" alt="${portalItem.fields.title}" class="w-full h-full object-cover">`;
        }
        innerHtml += `<div class="overlay"></div><h4>${portalItem.fields.title}</h4>`;
        portalButton.innerHTML = innerHtml;
        
        if (portalItem.fields.isHidden && !isAdminUnlocked) {
            portalButton.addEventListener('click', (e) => { e.stopPropagation(); openPasswordPrompt(portalItem); });
        } else {
            portalButton.addEventListener('click', (e) => { e.stopPropagation(); openPortal(portalItem); });
        }
        
        return portalButton;
    }
}

function openPasswordPrompt(portalItem) {
    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit-btn');
    const passwordText = document.getElementById('password-prompt-text');
    const passwordImage = document.getElementById('password-modal-image');
    const closeButton = passwordModal.querySelector('.modal-close-btn');
    if (portalItem.fields.portalImage?.fields?.file?.url) {
        passwordImage.src = 'https:' + portalItem.fields.portalImage.fields.file.url;
        passwordImage.classList.remove('hidden');
    } else {
        passwordImage.classList.add('hidden');
    }
    passwordText.innerHTML = `You stand before the <strong>${portalItem.fields.title}</strong> portal. Unlike the others, this one is unnervingly still. A single, ancient rune glows softly at its center, barring entry. To proceed, you must speak a word of power.`;
    passwordInput.value = '';
    const handleSubmit = () => {
        if (passwordInput.value === ADMIN_PASSWORD) {
            isAdminUnlocked = true;
            passwordModal.style.display = 'none';
            openPortal(portalItem);
        } else {
            alert('The word has no effect. The portal remains sealed.');
        }
    };
    passwordSubmit.onclick = handleSubmit;
    passwordInput.onkeyup = (e) => { if (e.key === 'Enter') handleSubmit(); };
    closeButton.onclick = () => passwordModal.style.display = 'none';
    passwordModal.onclick = (e) => { if (e.target === passwordModal) passwordModal.style.display = 'none'; };
    passwordModal.style.display = 'flex';
    passwordInput.focus();
}

function createWeaverCard(personality) {
    const weaverName = personality.fields.weaverName;
    const card = document.createElement('div');
    card.className = 'weaver-card portal-book';
    const randomRotation = (Math.random() - 0.5) * 8;
    card.style.transform = `rotate(${randomRotation}deg)`;
    let innerHtml = '';
    if (personality.fields.weaverImage?.fields?.file?.url) {
        innerHtml += `<img src="${'https:' + personality.fields.weaverImage.fields.file.url}" alt="${weaverName}" class="w-full h-full object-cover">`;
    }
    innerHtml += `<div class="overlay"></div><h4>${weaverName}</h4>`;
    card.innerHTML = innerHtml;
    if (weaverName.toLowerCase().includes('breath weaver')) {
        card.addEventListener('click', () => openCharacterGenerator(personality));
    } else {
        card.addEventListener('click', () => openWeaverTool(personality));
    }
    return card;
}

function openWeaverTool(personality) {
    const newModal = modalTemplate.cloneNode(true);
    newModal.removeAttribute('id');
    newModal.style.zIndex = zIndexCounter++;
    const modalBody = newModal.querySelector('#main-modal-body');
    const closeButton = newModal.querySelector('.modal-close-btn');
    const weaverName = personality.fields.weaverName;
    modalBody.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-serif text-amber-300">${weaverName}</h2></div>
        <div class="modal-body text-gray-300">
            <div class="flex flex-col gap-6 mb-6">
                ${personality.fields.weaverImage ? `<img src="https:${personality.fields.weaverImage.fields.file.url}" alt="${weaverName}" class="w-full h-auto object-cover rounded-lg border-2 border-gray-600">` : ''}
                <div class="flex-1 italic">${documentToHtmlString(personality.fields.introductoryText)}</div>
            </div>
            <div>
                <textarea class="weaver-input block p-2.5 w-full text-sm text-white bg-gray-700 rounded-lg border border-gray-600" rows="3" placeholder="..."></textarea>
                <button class="weaver-submit-btn mt-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded">${personality.fields.buttonLabel || 'Submit'}</button>
                <div class="weaver-result-wrapper mt-4 p-4 bg-gray-900/50 rounded-lg hidden relative">
                    <button class="copy-icon-btn">
                        <svg class="icon-pen" viewBox="0 0 24 24"><path d="M13.5,6.5l3,3l-3,3l-3-3L13.5,6.5z M20.4,2c-0.2,0-0.4,0.1-0.6,0.2l-2.4,2.4l3,3l2.4-2.4c0.3-0.3,0.3-0.8,0-1.2l-1.8-1.8 C20.8,2.1,20.6,2,20.4,2z M4,18c-0.6,0.6-0.6,1.5,0,2.1c0.6,0.6,1.5,0.6,2.1,0L18,8.2l-3-3L4,16.1V18z M11.9,14.2l-3,3H8l-4,4 l1.4,1.4l4-4v-0.9l3-3L11.9,14.2z"></path></svg>
                        <svg class="icon-scroll hidden" viewBox="0 0 24 24"><path d="M19,2H5C3.9,2,3,2.9,3,4v16c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V4C21,2.9,20.1,2,19,2z M15,8H9C8.4,8,8,7.6,8,7 s0.4-1,1-1h6c0.6,0,1,0.4,1,1S15.6,8,15,8z M15,12H9c-0.6,0-1-0.4-1-1s0.4-1,1-1h6c0.6,0,1,0.4,1,1S15.6,12,15,12z M12,16H9 c-0.6,0-1-0.4-1-1s0.4-1,1-1h3c0.6,0,1,0.4,1,1S12.6,16,12,16z"></path></svg>
                    </button>
                    <div class="weaver-result"></div>
                </div>
            </div>
        </div>
    `;
    const submitBtn = modalBody.querySelector('.weaver-submit-btn');
    submitBtn.addEventListener('click', () => handleWeaverRequest(weaverName, modalBody.querySelector('.weaver-input'), modalBody.querySelector('.weaver-result'), submitBtn));
    
    const copyBtn = modalBody.querySelector('.copy-icon-btn');
    copyBtn.addEventListener('click', e => {
        const textToCopy = copyBtn.nextElementSibling.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.querySelector('.icon-pen').classList.add('hidden');
            copyBtn.querySelector('.icon-scroll').classList.remove('hidden');
            setTimeout(() => {
                copyBtn.querySelector('.icon-pen').classList.remove('hidden');
                copyBtn.querySelector('.icon-scroll').classList.add('hidden');
            }, 2000);
        });
    });

    closeButton.addEventListener('click', () => { newModal.remove(); zIndexCounter--; });
    newModal.addEventListener('click', (e) => {
        if (e.target === newModal) { newModal.remove(); zIndexCounter--; }
    });
    modalContainer.appendChild(newModal);
    newModal.style.display = 'flex';
}

function openCharacterGenerator(personality) {
    if (!characterOptions) {
        alert("Character options not loaded. Please ensure they are published in Contentful.");
        return;
    }
    const newModal = modalTemplate.cloneNode(true);
    newModal.removeAttribute('id');
    newModal.style.zIndex = zIndexCounter++;
    const modalBody = newModal.querySelector('#main-modal-body');
    const closeButton = newModal.querySelector('.modal-close-btn');
    const weaverName = personality.fields.weaverName;

    // CHANGED: The container div and the img tag below have been updated.
    modalBody.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-serif text-amber-300">${weaverName}</h2></div>
        <div id="char-gen-body" class="modal-body text-gray-300">
             <div class="flex flex-col gap-6 mb-6 text-left">
                ${personality.fields.weaverImage ? `<img src="https:${personality.fields.weaverImage.fields.file.url}" alt="${weaverName}" class="w-full h-auto object-cover rounded-lg border-2 border-gray-600">` : ''}
                <div class="italic">${documentToHtmlString(personality.fields.introductoryText)}</div>
            </div>
            <div class="flex flex-wrap gap-4 mb-6 border-t border-b border-gray-700 py-4">
                <button id="add-kinship-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm">⊕ Add Kinship</button>
                <button id="add-calling-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm">⊕ Add Calling</button>
                <button id="add-spirit-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm">⊕ Add Spirit</button>
                <button id="add-background-btn" class="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded text-sm">⊕ Add Background</button>
            </div>
            <div id="kinship-container" class="space-y-3 mb-4"></div>
            <div id="calling-container" class="space-y-3 mb-4"></div>
            <div id="spirit-container" class="space-y-3 mb-4"></div>
            <div id="background-container" class="space-y-3 mb-4"></div>
            <div class="mb-4">
                <label for="char-notes" class="block mb-2 text-sm font-medium text-gray-300">Optional Notes</label>
                <textarea id="char-notes" rows="2" class="block p-2.5 w-full text-sm text-white bg-gray-700 rounded-lg border border-gray-600" placeholder="e.g., 'Wears a broken mask', 'Loves spicy ramen'..."></textarea>
            </div>
            <button id="generate-char-button" class="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded">Weave the Breath</button>
            <div class="weaver-result-wrapper mt-4 p-4 bg-gray-800/50 rounded-lg hidden relative">
                <button class="copy-icon-btn">
                    <svg class="icon-pen" viewBox="0 0 24 24"><path d="M13.5,6.5l3,3l-3,3l-3-3L13.5,6.5z M20.4,2c-0.2,0-0.4,0.1-0.6,0.2l-2.4,2.4l3,3l2.4-2.4c0.3-0.3,0.3-0.8,0-1.2l-1.8-1.8 C20.8,2.1,20.6,2,20.4,2z M4,18c-0.6,0.6-0.6,1.5,0,2.1c0.6,0.6,1.5,0.6,2.1,0L18,8.2l-3-3L4,16.1V18z M11.9,14.2l-3,3H8l-4,4 l1.4,1.4l4-4v-0.9l3-3L11.9,14.2z"></path></svg>
                    <svg class="icon-scroll hidden" viewBox="0 0 24 24"><path d="M19,2H5C3.9,2,3,2.9,3,4v16c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V4C21,2.9,20.1,2,19,2z M15,8H9C8.4,8,8,7.6,8,7 s0.4-1,1-1h6c0.6,0,1,0.4,1,1S15.6,8,15,8z M15,12H9c-0.6,0-1-0.4-1-1s0.4-1,1-1h6c0.6,0,1,0.4,1,1S15.6,12,15,12z M12,16H9 c-0.6,0-1-0.4-1-1s0.4-1,1-1h3c0.6,0,1,0.4,1,1S12.6,16,12,16z"></path></svg>
                </button>
                <div class="weaver-result"></div>
            </div>
        </div>
    `;
    const charGenBody = modalBody.querySelector('#char-gen-body');
    
    const populateSelect = (select, options) => {
        select.innerHTML = '';
        select.add(new Option('(Random)', 'RANDOM'));
        options.forEach(opt => select.add(new Option(opt, opt)));
        select.add(new Option('(Custom...)', 'CUSTOM_ENTRY'));
    };

    const addRow = (containerId, optionsConfig) => {
        const container = charGenBody.querySelector(containerId);
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 p-2 rounded-md bg-black/20';

        const createSelectWrapper = (label, selectClass, inputClass) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex-1 hidden';
            wrapper.innerHTML = `
                <label class="block text-xs text-gray-400 mb-1">${label}</label>
                <select class="${selectClass} w-full bg-gray-600 p-2.5"></select>
                <input type="text" class="${inputClass} hidden w-full bg-gray-800 p-2.5 text-white rounded" placeholder="Enter custom...">
            `;
            return wrapper;
        };

        const mainWrapper = createSelectWrapper(optionsConfig.label, 'main-select', 'main-custom-input');
        mainWrapper.classList.remove('hidden');
        const subWrapper = createSelectWrapper(`Sub-${optionsConfig.label}`, 'sub-select', 'sub-custom-input');
        const tertiaryWrapper = createSelectWrapper('Type', 'tertiary-select', 'tertiary-custom-input');
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn text-red-400 font-bold text-xl self-end pb-1';
        removeBtn.innerHTML = '⊖';

        row.append(mainWrapper, subWrapper, tertiaryWrapper, removeBtn);
        container.appendChild(row);

        const mainSelect = row.querySelector('.main-select');
        const mainCustomInput = row.querySelector('.main-custom-input');
        const subSelect = row.querySelector('.sub-select');
        const subCustomInput = row.querySelector('.sub-custom-input');
        const tertiarySelect = row.querySelector('.tertiary-select');
        const tertiaryCustomInput = row.querySelector('.tertiary-custom-input');

        const handleCustomToggle = (selectEl, inputEl) => {
            const isCustom = selectEl.value === 'CUSTOM_ENTRY';
            selectEl.classList.toggle('hidden', isCustom);
            inputEl.classList.toggle('hidden', !isCustom);
            if (isCustom) inputEl.focus();
        };
        
        populateSelect(mainSelect, optionsConfig.main);

        mainSelect.addEventListener('change', () => {
            handleCustomToggle(mainSelect, mainCustomInput);
            const selectedMain = mainSelect.value;
            const subOptions = optionsConfig.getSubs(selectedMain);

            tertiaryWrapper.classList.add('hidden');
            tertiarySelect.innerHTML = '';
            
            if (subOptions && subOptions.length > 0) {
                if (subOptions[0]?.sys?.contentType?.sys?.id === 'subTypeGroup') {
                    populateSelect(subSelect, subOptions.map(s => s.fields.groupName));
                } else {
                    populateSelect(subSelect, subOptions);
                }
                subWrapper.classList.remove('hidden');
                subSelect.disabled = false;
                subSelect.dispatchEvent(new Event('change'));
            } else {
                subWrapper.classList.add('hidden');
                subSelect.innerHTML = '';
                subSelect.disabled = true;
            }
        });

        subSelect.addEventListener('change', () => {
            handleCustomToggle(subSelect, subCustomInput);
            const selectedMain = mainSelect.value;
            const selectedSub = subSelect.value;
            const tertiaryOptions = optionsConfig.getTertiaries(selectedMain, selectedSub);

            if (tertiaryOptions && tertiaryOptions.length > 0) {
                populateSelect(tertiarySelect, tertiaryOptions);
                tertiaryWrapper.classList.remove('hidden');
                tertiarySelect.disabled = false;
            } else {
                tertiaryWrapper.classList.add('hidden');
                tertiarySelect.innerHTML = '';
                tertiarySelect.disabled = true;
            }
        });

        tertiarySelect.addEventListener('change', () => handleCustomToggle(tertiarySelect, tertiaryCustomInput));
        
        mainSelect.dispatchEvent(new Event('change'));
    };
    
    const kinshipConfig = {
        label: 'Kinship',
        main: (characterOptions.kinships || []).map(k => k.fields.title),
        getSubs: (kinshipTitle) => {
            const kinship = (characterOptions.kinships || []).find(k => k.fields.title === kinshipTitle);
            return kinship?.fields?.subKinshipGroups || [];
        },
        getTertiaries: (kinshipTitle, subGroupName) => {
            const kinship = (characterOptions.kinships || []).find(k => k.fields.title === kinshipTitle);
            const subGroup = (kinship?.fields?.subKinshipGroups || []).find(s => s.fields.groupName === subGroupName);
            return subGroup?.fields?.options || [];
        }
    };
    
    const callingConfig = {
        label: 'Calling',
        main: (characterOptions.callings || []).map(c => c.fields.title),
        getSubs: (callingTitle) => {
            const calling = (characterOptions.callings || []).find(c => c.fields.title === callingTitle);
            return calling?.fields?.subCallingGroups || [];
        },
        getTertiaries: (callingTitle, subGroupName) => {
            const calling = (characterOptions.callings || []).find(c => c.fields.title === callingTitle);
            const subGroup = (calling?.fields?.subCallingGroups || []).find(s => s.fields.groupName === subGroupName);
            return subGroup?.fields?.options || [];
        }
    };

    charGenBody.querySelector('#add-kinship-btn').addEventListener('click', () => addRow('#kinship-container', kinshipConfig));
    charGenBody.querySelector('#add-calling-btn').addEventListener('click', () => addRow('#calling-container', callingConfig));
    charGenBody.querySelector('#add-spirit-btn').addEventListener('click', () => addRow('#spirit-container', { label: 'Spirit', main: (characterOptions.spirits || []).map(s => s.fields.title), getSubs: () => [], getTertiaries: () => [] }));
    charGenBody.querySelector('#add-background-btn').addEventListener('click', () => addRow('#background-container', { label: 'Background', main: characterOptions.backgrounds || [], getSubs: () => [], getTertiaries: () => [] }));
    
    charGenBody.addEventListener('click', e => { if (e.target.classList.contains('remove-btn')) { e.target.parentElement.remove(); } });
    
    const generateBtn = modalBody.querySelector('#generate-char-button');
    generateBtn.addEventListener('click', () => {
        const getSelectionsForPrompt = () => {
            let promptText = '';
            const processContainer = (containerId, category) => {
                const selections = [];
                modalBody.querySelectorAll(`${containerId} > div`).forEach(row => {
                    const getVal = (type) => {
                        const sel = row.querySelector(`.${type}-select`);
                        if (!sel || sel.disabled) return null;
                        if (sel.value === 'CUSTOM_ENTRY') {
                            return row.querySelector(`.${type}-custom-input`).value.trim();
                        }
                        return sel.value === 'RANDOM' ? null : sel.value;
                    };

                    const mainVal = getVal('main');
                    if (mainVal) {
                        const subVal = getVal('sub');
                        const tertiaryVal = getVal('tertiary');
                        let selectionText = mainVal;
                        if (subVal) {
                            if (tertiaryVal) {
                                selectionText = `${mainVal} (${subVal} - ${tertiaryVal})`;
                            } else {
                                selectionText = `${mainVal} (${subVal})`;
                            }
                        }
                        selections.push(selectionText);
                    }
                });
                if (selections.length > 0) {
                    promptText += `\n- ${category}: ${selections.join(' and ')}`;
                }
            };
            processContainer('#kinship-container', 'Kinship');
            processContainer('#calling-container', 'Calling');
            processContainer('#spirit-container', 'Spirit');
            processContainer('#background-container', 'Background');
            return promptText;
        }

        const getSelectionsForRag = () => {
            const selections = {};
            const processContainer = (containerId, category) => {
                const selectionValues = [];
                modalBody.querySelectorAll(`${containerId} > div`).forEach(row => {
                    const getVal = (type) => {
                        const sel = row.querySelector(`.${type}-select`);
                        if (!sel || sel.disabled) return null;
                        if (sel.value === 'CUSTOM_ENTRY') {
                            return row.querySelector(`.${type}-custom-input`).value.trim();
                        }
                        return sel.value === 'RANDOM' ? null : sel.value;
                    };
                    const mainVal = getVal('main');
                    if(mainVal) selectionValues.push(mainVal);
                    const subVal = getVal('sub');
                    if(subVal) selectionValues.push(subVal);
                    const tertiaryVal = getVal('tertiary');
                    if(tertiaryVal) selectionValues.push(tertiaryVal);
                });
                if (selectionValues.length > 0) {
                    selections[category] = selectionValues.join(' ');
                }
            };
            processContainer('#kinship-container', 'Kinship');
            processContainer('#calling-container', 'Calling');
            processContainer('#spirit-container', 'Spirit');
            processContainer('#background-container', 'Background');
            return selections;
        }

        const promptSelectionsText = getSelectionsForPrompt();
        const selectionsObject = getSelectionsForRag();
        const notes = modalBody.querySelector('#char-notes').value;

        let prompt = `Generate a character concept for the Yurei-tu-Shima campaign setting, using D&D 5e as the ruleset.`;
        prompt += promptSelectionsText;
        if (notes) {
            prompt += `\n- Notes: "${notes}"`;
            selectionsObject['Notes'] = notes;
        }
        prompt += `\n\nProvide a character concept including a name, detailed physical and personality descriptions, and a plot hook.`;

        const resultDiv = modalBody.querySelector('.weaver-result');
        const submitButton = modalBody.querySelector('#generate-char-button');
        handleWeaverRequest(weaverName, { value: prompt }, resultDiv, submitButton, selectionsObject);
    });
    
    const copyBtn = modalBody.querySelector('.copy-icon-btn');
    copyBtn.addEventListener('click', e => {
        const textToCopy = copyBtn.nextElementSibling.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.querySelector('.icon-pen').classList.add('hidden');
            copyBtn.querySelector('.icon-scroll').classList.remove('hidden');
            setTimeout(() => {
                copyBtn.querySelector('.icon-pen').classList.remove('hidden');
                copyBtn.querySelector('.icon-scroll').classList.add('hidden');
            }, 2000);
        });
    });

    closeButton.addEventListener('click', () => { newModal.remove(); zIndexCounter--; });
    newModal.addEventListener('click', (e) => {
        if (e.target === newModal) { newModal.remove(); zIndexCounter--; }
    });
    modalContainer.appendChild(newModal);
    newModal.style.display = 'flex';
}

async function handleWeaverRequest(weaverName, inputElement, resultElement, buttonElement, selections = null) {
    const prompt = inputElement.value;
    if (!prompt) return;
    resultElement.parentElement.style.display = 'block';
    resultElement.innerHTML = `<p class="text-amber-300 italic">The loom hums as threads gather...</p>`;
    buttonElement.disabled = true;
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, weaverName, selections }),
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

async function initializeSite() {
    try {
        const [portalResponse, personalityResponse, optionsResponse] = await Promise.all([
            client.getEntries({ content_type: 'lore', 'fields.isTopLevel': true, order: 'fields.sortOrder', include: 10 }),
            client.getEntries({ content_type: 'aiPersonality', include: 2 }),
            client.getEntries({ content_type: 'characterOptions', limit: 1, include: 10 })
        ]);
        
        const allTopLevelPortals = portalResponse.items;
        aiPersonalities = personalityResponse.items;
        if (optionsResponse.items.length > 0) {
            characterOptions = optionsResponse.items[0].fields;
        }
        
        await loadHomepageContent();
        const portalGrid = document.getElementById('portal-grid');
        
        if (!allTopLevelPortals.length) {
            portalGrid.innerHTML = '<p class="text-center text-amber-200">No top-level portals found.</p>';
        } else {
            allTopLevelPortals.forEach(item => { portalGrid.appendChild(createGenericElement(item)); });
        }
    } catch (error) {
        console.error(error);
        document.getElementById('portal-grid').innerHTML = '<p class="text-center text-red-400">Error fetching content.</p>';
    }
}

initializeSite();