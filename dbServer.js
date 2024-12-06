const express = require("express")
const app = express()
const cors = require('cors');
app.use(cors());
const mysql = require("mysql2/promise")
const nodemailer = require('nodemailer');

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use('/assets', express.static('assets'));


require("dotenv").config()

const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_DATABASE = process.env.DB_DATABASE
const DB_PORT = process.env.DB_PORT

const db = mysql.createPool({
   connectionLimit: 100,
   host: DB_HOST,
   user: DB_USER,
   password: DB_PASSWORD,
   database: DB_DATABASE,
   port: DB_PORT
})

db.getConnection( (err, connection)=> {   
   if (err) throw (err)
   console.log ("DB connected successful: " + connection.threadId)
})

const port = process.env.PORT
app.listen(port, ()=> console.log(`Server Started on port ${port}...`))

const bcrypt = require("bcrypt")
app.use(express.json())
//middleware to read req.body.<params>

//CREATE USER
app.post("/createUser", async (req, res) => {
    const { name, student_id, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const connection = await db.getConnection(); // Await the connection

        // Check if the user (student ID or email) already exists
        const sqlSearch = "SELECT * FROM user_table WHERE student_id = ? OR email = ?";
        const search_query = mysql.format(sqlSearch, [student_id, email]);

        const [result] = await connection.query(search_query); // Await the query result

        console.log("------> Search Results");
        console.log(result.length);

        if (result.length != 0) {
            connection.release();
            console.log("------> User already exists");
            res.sendStatus(409); // Conflict: User already exists
        } else {
            // Insert a new user into the database
            const sqlInsert = "INSERT INTO user_table (user_name, student_id, email, password_hash, user_type) VALUES (?,?,?,?,?)";
            const insert_query = mysql.format(sqlInsert, [name, student_id, email, hashedPassword, 'student']);

            const [insertResult] = await connection.query(insert_query); // Await the query result
            connection.release();

            console.log("--------> Created new User");
            console.log(insertResult.insertId);
            res.sendStatus(201); // Created: New user added successfully
        }
    } catch (err) {
        console.error(err);
        res.sendStatus(500); // Internal Server Error if something goes wrong
    }
});

//LOGIN (AUTHENTICATE USER)
app.post("/login", async (req, res) => {
    const user = req.body.name;
    const password = req.body.password;

    try {
        // Await the connection from the pool
        const connection = await db.getConnection();

        // Query to search for the user
        const sqlSearch = "SELECT * FROM user_table WHERE student_id = ?";
        const search_query = mysql.format(sqlSearch, [user]);

        // Await the query result
        const [result] = await connection.query(search_query);
        connection.release(); // Always release the connection

        if (result.length == 0) {
            console.log("--------> User does not exist");
            res.sendStatus(404); // User not found
        } else {
            // Retrieve the hashed password from the result
            const hashedPassword = result[0].password_hash;

            // Compare the provided password with the stored hashed password
            const passwordMatch = await bcrypt.compare(password, hashedPassword);

            if (passwordMatch) {
                console.log("---------> Login Successful");

                 // Send a JSON response including user info
                 return res.status(200).json({
                    message: `${user} is logged in!`,
                    user_id: result[0].user_id,
                    user_email: result[0].user_email,
                    user_type: result[0].user_type,
                });
            } else {
                console.log("---------> Password Incorrect");
                return res.status(401).json({ message: "Password incorrect!" });
            }
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal Server Error" }); // Internal Server Error if something goes wrong
    }
});


app.set('view engine', 'ejs');

app.get('/admin', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM user_table');
        res.render('admin', { users: rows });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Error fetching user data');
    }
});

// Define route for /reservation
app.get('/reservation', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM reservation_table');
        res.render('reservation', { reservation: rows });
    } catch (error) {
        console.error('Error fetching reservation data:', error);
        res.status(500).send('Error fetching reservation data');
    }
});

// Define route for /reservation
app.get('/key', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM key_handover_table');
        res.render('key', { key: rows });
    } catch (error) {
        console.error('Error fetching key handover data:', error);
        res.status(500).send('Error fetching key handover data');
    }
});

let globalUserId;

app.post('/localStorage', (req, res) => {
  globalUserId = req.body.userId; // Ensure you parse the body correctly
});

const multer = require('multer');

// Configure multer to handle file uploads
const storage = multer.memoryStorage(); // Stores file in memory as Buffer
const upload = multer({ storage });

// Route to handle form submission
app.post('/update-status', upload.none(), async (req, res) => {
    console.log('Request Body:', req.body);  // Log the entire request body
    const { reservationId, newStatus } = req.body;
  
    if (!reservationId || !newStatus) {
      return res.status(400).json({ success: false, message: 'Reservation ID and new status are required' });
    }
  
    try {
      // Update status in the database
      await db.query('UPDATE reservation_table SET status = ? WHERE reservation_id = ?', [newStatus, reservationId]);

      // Fetch user's email from the database based on reservation_id
      const [user] = await db.query('SELECT * FROM reservation_table WHERE reservation_id = ?', [reservationId]);

      if (!user || !user[0].email) {
          return res.status(404).json({ success: false, message: 'User email not found' });
      }

      // Set up nodemailer
      const transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email service (Gmail, Outlook, etc.)
        auth: {
            user: process.env.EMAIL_USER, // Replace with your email
            pass: process.env.EMAIL_PASS, // Replace with your email password or app-specific password
        },
    });

    let mailOPtions;

    if (newStatus == "approved"){
        // Email options
        mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to: user[0].email, // User's email address
        subject: 'Class Reservation Confirmation',
        text: `Hi ${user[0].name},\n\nYour reservation for ${user[0].class_name} on ${user[0].reservation_date} at ${user[0].start_time} has been ${newStatus}.\n\nPlease come to the department office to take the key.\n\nThank you!`, // Email content
        };
    }else{
        // Email options
        mailOptions = {
            from: process.env.EMAIL_USER, // Sender address
            to: user[0].email, // User's email address
            subject: 'Class Reservation Confirmation',
            text: `Hi ${user[0].name},\n\nYour reservation for ${user[0].class_name} on ${user[0].reservation_date} at ${user[0].start_time} has been ${newStatus}.\n\nIf you need further detail, please contact the department office.\n\nThank you!`, // Email content
        };
    }

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Reservation status updated and email sent successfully.' });

    } catch (error) {
      console.error('Error updating status:', error);
      res.json({ success: false });
    }
  });

app.post('/book-class', upload.single('picture'), async (req, res) => {

    const { 'class-name': className, date, 'time' :time_buttons, name, 'student-id': student_id, department, 'phone-number': phone_number, purpose, 'total-students': total_students } = req.body;

    if (!className) {
        return res.status(400).json({ success: false, message: 'Class name is required' });
    }

    try {
        const pictureBuffer = req.file ? req.file.buffer : null; // Handle optional file upload

        // Fetch user's email from the database based on student_id
        const [user] = await db.query('SELECT email FROM user_table WHERE student_id = ?', [student_id]);

        if (!user || !user[0].email) {
            return res.status(404).json({ success: false, message: 'User email not found' });
        }
 
        const userEmail = user[0].email;

        //insert data to database
        await db.query(
            'INSERT INTO reservation_table (class_name, reservation_date, start_time, name, student_id, picture, department, phone_number, purpose, number_of_students, status, user_id, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                className,
                date,
                time_buttons,
                name,
                student_id,
                pictureBuffer,
                department,
                phone_number,
                purpose,
                total_students,
                "Pending",
                globalUserId,
                userEmail,
            ]
        );

        // Set up nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Use your email service (Gmail, Outlook, etc.)
            auth: {
                user: process.env.EMAIL_USER, // Replace with your email
                pass: process.env.EMAIL_PASS, // Replace with your email password or app-specific password
            },
        });

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER, // Sender address
            to: userEmail, // User's email address
            subject: 'Class Reservation Confirmation',
            text: `Hi ${name},\n\nYour reservation for ${className} on ${date} at ${time_buttons} has been received.\n\nThank you!`, // Email content
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'Reservation submitted and email sent successfully.' });
    } catch (error) {
        console.error('Error inserting data into the database:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/image/:reservation_id', async (req, res) => {
    const { reservation_id } = req.params;  // Retrieve the reservation ID from the URL
    
    try {
        // Query your database to get the image data (BLOB) based on reservation_id
        const [result] = await db.query('SELECT picture FROM reservation_table WHERE reservation_id = ?', [reservation_id]);

        // Check if the image exists for this reservation
        if (result.length === 0 || !result[0].picture) {
            return res.status(404).send('Image not found');
        }

        const pictureBuffer = result[0].picture;  // Assuming 'picture' is the BLOB field in the table

        // Set the content type for the image (adjust based on your image format)
        res.setHeader('Content-Type', 'image/jpeg');  // Change to image/png or other formats if necessary
        
        // Send the image data as the response
        res.send(pictureBuffer);
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/user-history', async (req, res) => {

    if (!globalUserId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    try {
        // Query to fetch reservation records for the given userId from the reservation_table
        const [rows] = await db.query(
            'SELECT * FROM reservation_table WHERE user_id = ? ORDER BY reservation_date DESC, start_time DESC',
            [globalUserId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No reservations found for this user' });
        }

        res.json({ success: true, history: rows });
    } catch (error) {
        console.error('Error fetching user reservation history:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint to handle form submission
app.post('/key-handover', upload.none(), async (req, res) => {
    const { reservation_id, key_given_time, key_return_time, status } = req.body;
    console.log(req.body);
  
    try {
      // Check if the reservation ID already exists in the table
      const checkSql = 'SELECT * FROM key_handover_table WHERE reservation_id = ?';
      const checkResult = await db.query(checkSql, [reservation_id]);
      console.log(checkResult)
  
      if (checkResult[0].length > 0) {
        // If the reservation ID exists, update the status only
        const updateSql = 'UPDATE key_handover_table SET status = ? WHERE reservation_id = ?';
        await db.query(updateSql, [status, reservation_id]);
        console.log('Status updated successfully.');
        
        return res.json({ success: true, message: 'Key handover status updated successfully!' });
      } else {
        // If the reservation ID does not exist, insert a new record
        const insertSql = `
          INSERT INTO key_handover_table (reservation_id, key_given_time, key_return_time, status)
          VALUES (?, ?, ?, ?)
        `;
        await db.query(insertSql, [reservation_id, key_given_time, key_return_time, status]);
        console.log('Record added successfully.');
        return res.json({ success: true, message: 'Key handover record added successfully!' });
      }
    } catch (err) {
      console.error('Error:', err);
      return res.status(500).send('An error occurred while processing the request.');
    }
  });
  
  
