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


