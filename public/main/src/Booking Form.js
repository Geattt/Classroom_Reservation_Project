function selectTime(time, button) {
    // Set the value of the hidden input field
    document.getElementById('selected-time').value = time;

    // Remove the 'selected' class from all buttons
    const buttons = document.querySelectorAll('.time-button');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
    });

    // Add the 'selected' class to the clicked button
    button.classList.add('selected'); // Use the button passed as argument
}

// Function to get query parameter from URL
function getQueryParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Pre-fill the class name if available in the URL
window.onload = function() {
    const classNameField = document.getElementById('class-name');
    const className = getQueryParameter('class');
    if (className) {
        classNameField.value = className;
    }
};

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Set the class name input value from the URL
document.getElementById('class-name').value = getQueryParam('class-name');

document.querySelector('form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission
    bookClass(); // Call the bookClass function
});


function bookClass(){
    
    // Get the class name from the URL and store it in a variable
    var className = getQueryParam('class');
    // Set the class name input value
    document.getElementById('class-name').value = className;
    var date = document.getElementById('date').value;
    var time_buttons = document.getElementById('selected-time').value;
    var name = document.getElementById('name').value;
    var student_id = document.getElementById('student-id').value;
    var department = document.getElementById('department').value;
    var phone_number = document.getElementById('phone-number').value;
    var purpose = document.getElementById('purpose').value;
    var total_students = document.getElementById('total-students').value;

     // Retrieve userId from localStorage
     const userId = localStorage.getItem('userId');
     if (!userId) {
         alert('User ID not found in local storage.');
         return;
     }

    const form = document.getElementById('book-class-form');
    const formData = new FormData(form); // Automatically includes file and input fields

    // Append userId to the formData
    formData.append('userId', userId);

    fetch('/book-class', {
        method: 'POST',
        body: formData, // Send as multipart/form-data
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert('Request successfully submitted');
          location.href="main-menu.html" // Reload to reflect changes
        } else {
          alert('Error submitting form : ' + data.message);
        }
      })
      .catch(error => console.error('Error:', error));
}


function disableOccupiedButtons(data) {
    
    // Enable all buttons first to reset the state
    const allButtons = document.querySelectorAll('.time-button');
    allButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('disabled-button'); // Remove the disabled styling
    });

    data.forEach(slot => {
        // Remove seconds from the time (e.g., '17:30:00' -> '17:30')
        const timeWithoutSeconds = slot.time.slice(0, 5);
        
        if (slot.status === 'Occupied') {
            const button = document.querySelector(`.time-button[onclick="selectTime('${timeWithoutSeconds}', this)"]`);
            if (button) {
                button.disabled = true;
                button.classList.add('disabled-button'); // Optional: Add a CSS class for styling
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Get the class name from the URL and store it in a variable
    var className = getQueryParam('class');
    // Set the class name input value
    document.getElementById('class-name').value = className;

    // Get the input field for the date
    const dateInput = document.getElementById('date');
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];  // Extract the YYYY-MM-DD part
    
    // Set the default value of the date input to today's date
    dateInput.value = dateInput.value || todayFormatted;

    // Use the selected or today's date
    const selectedDate = dateInput.value;

    // Call fetchStatus with the selected class name and the selected date
    fetchStatus(className, selectedDate);

    // Listen for any change in the date input field
    dateInput.addEventListener('change', (event) => {
        const newDate = event.target.value;
        fetchStatus(className, newDate);
    });
});


// Function to fetch the status from the server
function fetchStatus(className, date) {
    fetch('/get-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, date })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Fetched status:', data.data);
            disableOccupiedButtons(data.data);
        } else {
            console.error('Error fetching status:', data.message);
        }
    })
    .catch(error => console.error('Error:', error));
}


