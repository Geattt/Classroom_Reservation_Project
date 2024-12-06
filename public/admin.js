const toggleButton = document.getElementById('toggle-btn')
const sidebar = document.getElementById('sidebar')

function toggleSidebar(){
  sidebar.classList.toggle('close')
  toggleButton.classList.toggle('rotate')

  closeAllSubMenus()
}

function toggleSubMenu(button){

  if(!button.nextElementSibling.classList.contains('show')){
    closeAllSubMenus()
  }

  button.nextElementSibling.classList.toggle('show')
  button.classList.toggle('rotate')

  if(sidebar.classList.contains('close')){
    sidebar.classList.toggle('close')
    toggleButton.classList.toggle('rotate')
  }
}

function closeAllSubMenus(){
  Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
    ul.classList.remove('show')
    ul.previousElementSibling.classList.remove('rotate')
  })
}

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

  const form = document.getElementById('book-class-form');
  const formData = new FormData(form); // Automatically includes file and input fields

  fetch('/book-class', {
      method: 'POST',
      body: formData, // Send as multipart/form-dat
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('Request successfully submitted');
        location.reload(); // Reload to reflect changes
      } else {
        alert('Error submitting form : ' + data.message);
      }
    })
    .catch(error => console.error('Error:', error));
}