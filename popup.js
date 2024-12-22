// Get the toggle switch element
const toggleSwitch = document.querySelector('.toggle-container input[type="checkbox"]');

// On load, retrieve the toggle preference from storage
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['togglePreference'], (result) => {
        const isChecked = result.togglePreference || false; // Default to `false` if not set
        toggleSwitch.checked = isChecked; // Set the toggle state
    });
});

// Listen for changes to the toggle switch
toggleSwitch.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
  
    // Save the toggle preference to storage
    chrome.storage.local.set({ togglePreference: isChecked }, () => {
      console.log('Toggle preference saved:', isChecked);
    });
  
    const message = isChecked ? { action: 'toggleSidebarOn' } : { action: 'toggleSidebarOff' };
    // Perform actions based on the toggle state
    chrome.tabs.query({}, (tabs) => {
        for(let tab of tabs) {
            chrome.tabs.sendMessage(tab.id, message, (response) => {
                console.log(response?.status || 'No response from content script');
            });
        }
    });
  });
