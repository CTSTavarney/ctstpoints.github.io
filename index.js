class CategoryManager {

    /* Private properties:
        _categoryObjectList
        _currentCategoryObject
        _currentListContainerDom
        _buttonContainerDom
        _searchDom
    */

    constructor(categoryList) {
        // List of Category objects instantiated for each category ("competitor", "events", "points")
        this._categoryObjectList = new Map();

        // The currently-active Category object
        this._currentCategoryObject = null;

        // The DOM element that contains, as its only child, the DOM node for the current category's search list
        // When a new category is activated, remove the previous child,
        // then add the category's DOM node to this element
        this._currentListContainerDom = document.getElementById('currentListContainerId');

        // Will register a single click-handler on the button container, rather than each individual button
        this._buttonContainerDom = document.getElementById('buttonContainerId');

        // A single search input field will be used to search the current Category's index list
        this._searchDom = document.getElementById('searchId');

        // Instantiate Category objects, using the first Category object as the default
        let defaultCategoryName = '';
        for (const { name, fnamePrefix, placeholder } of categoryList) {
            if (!defaultCategoryName) {
                defaultCategoryName = name;
            }
            this._categoryObjectList.set(name, new Category(name, fnamePrefix, placeholder));
        }

        // sessionStorage is used to keep track of the currently-selected Category and search input value,
        // primarily so that the browser Back button works
    
        let searchValue = sessionStorage.getItem('searchValue') || '';

        // If no category has yet been saved, select the first category as the default
        let categoryName = sessionStorage.getItem('categoryName') || defaultCategoryName;

        // Reset the search input field if no Category was saved
        if (!categoryName) {
            searchValue = '';
            try { sessionStorage.setItem('searchValue', ''); }
                catch (error) { console.error('Unable to write to sessionStorage:', error); }
        }

        // For now, clear the placeholder text; it will be set when the Category data is loaded
        this._searchDom.placeholder = '';

        // Restore any saved search input value
        this._searchDom.value = searchValue;

        // Ensure that event handlers have access to the 'this' object
        const me = this;

        // Handle click events on any of the buttons in the button container
        // Use the button's "value" attribute to determine which button was clicked    
        this._buttonContainerDom.addEventListener('click', (e) => {
            window.scrollTo(0, 0);
            const categoryName = e.target.value || '';
            if (categoryName) {
                // Save the category name in sessionStorage so that the browser Back button works
                try { sessionStorage.setItem('categoryName', categoryName); }
                    catch (error) { console.error('Unable to write to sessionStorage:', error); }

                // Clear "selected" class from all buttons
                const selectedButtonList = me._buttonContainerDom.getElementsByClassName('selected');
                for (let elem = 0; elem < selectedButtonList.length; elem++) {
                    selectedButtonList[elem].classList.remove('selected');
                }

                // Clear the search box
                me._searchDom.value = '';
                try { sessionStorage.setItem('searchValue', ''); }
                    catch (error) { console.error('Unable to write to sessionStorage:', error); }

                // Load the category
                me._loadCategory(categoryName);
            }
        });

        this._searchDom.addEventListener('input', (e) => {
            const searchValue = e.target.value;
            me._currentCategoryObject.searchCategory(searchValue);
            try { sessionStorage.setItem('searchValue', searchValue); }
                catch (error) { console.error('Unable to write to sessionStorage:', error); }
        });
    
        this._searchDom.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Check if there are any displayed category links; if so, send a click event to the first one
                me._currentCategoryObject.clickFirstMatch(me._searchDom.value);
            }
        });

        if (categoryName) {
            this._loadCategory(categoryName)
        }

        // Pre-cache the other categories
        for (const [k, v] of this._categoryObjectList) {
            if (k !== categoryName) {
                v.loadData();
            }
        }

    }

    _loadCategory(categoryName) {

        // Get the Category Object for the newly-selected Category
        this._currentCategoryObject = this._categoryObjectList.get(categoryName);

        // Add "selected" class to the clicked button
        this._currentCategoryObject.getCategoryButton.classList.add('selected');

        this._currentCategoryObject.loadData()
        .then( () => {
            // Set the newly-selected list as the current DOM element
            while (this._currentListContainerDom.firstChild) {
                this._currentListContainerDom.removeChild(this._currentListContainerDom.lastChild);
            }
            this._currentListContainerDom.appendChild(this._currentCategoryObject.getCategoryListContainerId);

            // Set the placeholder text in the search box
            this._searchDom.placeholder = this._currentCategoryObject.getCategoryPlaceholder;

            // Enable the search box
            this._searchDom.disabled = false;

            // Filter the search list
            this._currentCategoryObject.searchCategory(this._searchDom.value);
        });
    }

}

class Category {

    /* Private properties:
        _categoryName
        _fnamePrefix
        _placeholder
        _categoryListContainerDom
        _categoryDomList
        _categorySearchList
        _buttonDom
    */

    constructor(categoryName, fnamePrefix, placeholder) {

        this._categoryName = categoryName;
        this._fnamePrefix = fnamePrefix;
        this._placeholder = placeholder;

        // Will be the child element of currentListContainerId if this is the currently-selected category
        this._categoryListContainerDom = document.createElement('div');

        // List of the DOM (<a>) elements -- will show/hide based on search filter
        this._categoryDomList = [];

        // List of the category items' sanitized search terms
        this._categorySearchList = [];

        // Store the DOM element of this Category's <button> element
        this._buttonDom = document.getElementById('buttonContainerId')
                                  .querySelector(`button[value=${categoryName}`);

    }

    get getCategoryListContainerId() {
        return this._categoryListContainerDom;
    }
    
    get getCategoryPlaceholder() {
        return this._placeholder;
    }

    get getCategoryButton() {
        return this._buttonDom;
    }

    loadData() {
        return new Promise( (resolve, reject) => {

            // Don't load the data if it's already loaded
            if (this._categoryDomList.length > 0) {
                resolve();
            }
            else {
                // Read the index file for this category type
                fetch(`data/${this._categoryName}.json`)
                    .then( (fetchResponse) => fetchResponse.json() )
                    .then( (fetchResponseJson) => {
                        // Ensure the DOM and search lists are empty,
                        // in case multiple fetch requests were initiated
                        this._categoryDomList = [];
                        this._categorySearchList = [];
                        let child = this._categoryListContainerDom.lastElementChild; 
                        while (child) {
                            this._categoryListContainerDom.removeChild(child);
                            child = this._categoryListContainerDom.lastElementChild;
                        }
                        
                        // For each item in the data list, create a DOM text node under the categoryListContainer
                        const length = fetchResponseJson.data.length;
                        for (let i = 0; i < length; i++) {
                            const { k, v } = fetchResponseJson.data[i];

                            const div = document.createElement('div');
                            div.className = 'listItem';

                            const a = document.createElement('a');
                            a.id = this._fnamePrefix + k;
                            a.href = `data/${this._categoryName}/${this._fnamePrefix}${k}.html`;
                            a.appendChild(document.createTextNode(v));

                            div.appendChild(a);

                            // Add the item to the DOM list
                            this._categoryDomList.push(div);

                            // Sanitize the values in the category search list to facilitate efficient searching
                            this._categorySearchList.push(this._searchSanitize(v));

                            // Add the item as a child to the actual DOM container for the list items
                            this._categoryListContainerDom.appendChild(div);
                        }
                        resolve();
                    })
                    .catch(error => reject(error));
                }

        });
    }

    // If the user presses the Enter key when in the search box, display the page for the first matching category in the search list
    clickFirstMatch(value) {
        const searchList = this._categorySearchList;
        const domList = this._categoryDomList;
        const length = searchList.length;
        for (let i = 0; i < length; i++) {
            if (this._isMatch(value, searchList[i])) {
                // The DOM list is a list of <div> elements. The link (<a>) is the only child of the <div>
                domList[i].firstChild.click();
                break;
            }
        }
    }

    searchCategory(value) {
        const searchList = this._categorySearchList;
        const domList = this._categoryDomList;
        const length = searchList.length;
        for (let i = 0; i < length; i++) {
            if (this._isMatch(value, searchList[i])) {
                domList[i].style.display = 'block';
            }
            else {
                domList[i].style.display = 'none';
            }
        }
    }

    // inputText - The text input by the user in the search box
    // searchWords - Pre-sanitized list of words to search for the input text
    //
    // First, sanitize the user's search box input text,
    // which will result in a list of sanitized words, e.g: "  John-Boy,Mc'Smith  " becomes ["johnboy", "mcsmith"]
    // Then, check that each of the sanitized input words is contained within at least one of the search words
    // If so, return true. E.g. isMatch("  Joh,Mc'Smi  ", ["mcsmith", "johnboy"]) is a match,
    // since the sanitized input becomes ["joh", "mcsmi"]
    //
    _isMatch(inputText, searchWords) {
        const inputWords = this._searchSanitize(inputText);
        let inputFound = true;
        let inputIndex = 0;
        const inputWordsLength = inputWords.length;
        while (inputIndex < inputWordsLength) {
            let searchFound = false;
            let searchIndex = 0;
            const searchLength = searchWords.length;
            while (searchIndex < searchLength) {
                if (searchWords[searchIndex].includes(inputWords[inputIndex])) {
                    searchFound = true;
                    break;
                }
                searchIndex++;
            }
            if (!searchFound) {
                inputFound = false;
                break;
            }
            inputIndex++;
        }
        return inputFound;
    }

    // Convert the input string to a list of sanitized search words as follows:
    // - convert commas to spaces
    // - trim all leading and trailing spaces
    // - convert all multiple spaces to single spaces
    // - convert to lower case
    // - remove all characters except letters, digits, and spaces
    // - split on space characters
    _searchSanitize(value) {
        return value.replace(/,/g, ' ')
                    .trim()
                    .replace(/  +/g, ' ')
                    .toLowerCase()
                    .replace(/[^a-z0-9 ]/g, '')
                    .split(' ');
    }

}

window.addEventListener('load', () => {
    'use strict';

    /* Not Currently Used -- For future implementation of PWA offline functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw-VERSION.js');
    }
    */

    new CategoryManager([
        {name: 'competitors', fnamePrefix: 'c-', placeholder: 'Filter by Name and/or Number ...'},
        {name: 'events',      fnamePrefix: 'e-', placeholder: 'Filter by Event and/or Year ...'},
        {name: 'points',      fnamePrefix: 'p-', placeholder: 'Filter by Year ...'},
    ]);
});
