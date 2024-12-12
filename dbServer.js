const express = require("express")
const app = express()
const cors = require('cors');
app.use(cors());
const mysql = require("mysql2/promise")
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const multer = require('multer');

// Configure multer to handle file uploads
const storage = multer.memoryStorage(); // Stores file in memory as Buffer
const upload = multer({ storage });

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

            // Check if the user is blacklisted
            if (result[0].is_blacklisted == 1) {
                console.log("---------> User is blacklisted");
                return res.status(403).json({ message: "You are blacklisted and cannot log in. Please contact the administrator!" });
            }

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

// Define route for /admin
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

// Define route for /classroom
app.get('/classroom', async (req, res) => {
    res.render('classroom', { classroom: [] });
});

app.post('/classroom-query', upload.none(), async(req, res) =>{
    const {class_name, date} = req.body;
    const currentDate = new Date(date);  // Assuming date is a string or ISO date format
    currentDate.setDate(currentDate.getDate());  // Add one day

    // Convert currentDate to ISO string and then extract the date part
    const dateOnly = currentDate.toISOString().split('T')[0];

    try{
        const [rows] = await db.query('SELECT * FROM classroom_table WHERE class_name = ? AND date = ? ORDER BY classroom_id DESC', [class_name, dateOnly]);
        res.json(rows); // Send the data as JSON
    } catch (error) {
        console.error('Error fetching classroom data:', error);
        res.status(500).send('Error fetching classroom data');
    }
});

// Define route for /key
app.get('/key', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM key_handover_table');
        res.render('key', { key: rows });
    } catch (error) {
        console.error('Error fetching key handover data:', error);
        res.status(500).send('Error fetching key handover data');
    }
});

// Define route for /blacklist
app.get('/blacklist', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM blacklist_table');
        res.render('blacklist', { blacklist: rows });
    } catch (error) {
        console.error('Error fetching blacklist data:', error);
        res.status(500).send('Error fetching blacklist data');
    }
});

// Define route for /statistics
app.get('/statistics', async (req, res) => {
    try {
        //Count Reservations for Each Classroom
        const [rows] = await db.query(` SELECT class_name, 
                                            COUNT(*) AS reservations_this_month 
                                        FROM 
                                            reservation_table 
                                        WHERE 
                                            MONTH(reservation_date) = MONTH(CURRENT_DATE) 
                                            AND YEAR(reservation_date) = YEAR(CURRENT_DATE)
                                        GROUP BY 
                                            class_name;
                                    `);

        //Peak Usage Time
        const [rows2] = await db.query(`SELECT 
                                            COUNT(*) AS reservations , 
                                            HOUR(start_time) AS hour 
                                        FROM 
                                            reservation_table
                                        GROUP BY 
                                            HOUR(start_time)
                                        ORDER BY 
                                            reservations DESC
                                        LIMIT 5;
                                        `)
        
        //Average Number of Students per Reservation
        const [rows3] = await db.query(`SELECT 
                                            class_name, 
                                            Round(AVG(number_of_students)) AS average_students_per_reservation
                                        FROM 
                                            reservation_table
                                        GROUP BY 
                                            class_name;
                                        `);

        //Most Frequent Users
        const [rows4] = await db.query(`SELECT 
                                            name, 
                                            COUNT(*) AS reservation_count 
                                        FROM 
                                            reservation_table 
                                        GROUP BY 
                                            name 
                                        ORDER BY 
                                            reservation_count DESC
                                        LIMIT 5;
                                                `);


        //Availability Class rate
        const [rows5] = await db.query(`SELECT 
                                            class_name, 
                                            (COUNT(CASE WHEN status = 'empty' THEN 1 END) / COUNT(*)) * 100 AS availability_rate
                                        FROM 
                                            classroom_table
                                        GROUP BY 
                                            class_name;
                                                        `);

        // Combine data into a single object
        res.render('statistics', { 
            reservations: rows,
            time: rows2,
            number: rows3,
            users: rows4,
            availability: rows5
        });
    } catch (error) {
        console.error('Error fetching blacklist data:', error);
        res.status(500).send('Error fetching blacklist data');
    }
});


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

    const { 'class-name': className, date, 'time' :time_buttons, name, 'student-id': student_id, department, 'phone-number': phone_number, purpose, 'total-students': total_students, userId } = req.body;

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
        console.log(userId);
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
                userId,
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
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    try {
        // Query to fetch reservation records for the given userId
        const [rows] = await db.query(
            'SELECT class_name, reservation_id, start_time, name, student_id, reservation_date, number_of_students FROM reservation_table WHERE user_id = ? ORDER BY reservation_id ASC',
            [userId]
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
  
    try {
      // Check if the reservation ID already exists in the table
      const checkSql = 'SELECT * FROM key_handover_table WHERE reservation_id = ?';
      const checkResult = await db.query(checkSql, [reservation_id]);

      const userIdSql = 'SELECT user_id FROM reservation_table WHERE reservation_id = ?';
      const userIdResult = await db.query(userIdSql, [reservation_id]);

      // Check if the reservation ID  exists in the user table
      const [checkReservation] = await db.query('SELECT * FROM reservation_table WHERE user_id = ?', [reservation_id]);

      if (checkReservation.length > 0){
        if (checkResult[0].length > 0) {
            // If the reservation ID exists, update the status only
            const updateSql = 'UPDATE key_handover_table SET status = ? WHERE reservation_id = ?';
            await db.query(updateSql, [status, reservation_id]);
    
            if (status == "Overdue"){
    
                const blacklistStart = new Date(); // Current date
                const blacklistEnd = new Date();
                blacklistEnd.setDate(blacklistStart.getDate() + 7); // Add 7 days (1 week) to the current date
    
                // Add to blacklist table
                const blacklistSql = `
                    INSERT INTO blacklist_table (user_id, reason, blacklist_start, blacklist_end)
                    VALUES (?, ?, ?, ?)
                `;
    
                // Convert dates to string format (YYYY-MM-DD) for MySQL compatibility
                const blacklistStartDate = blacklistStart.toISOString().split('T')[0];
                const blacklistEndDate = blacklistEnd.toISOString().split('T')[0];
    
                await db.query(blacklistSql, [userIdResult[0][0].user_id, "Your key is overdue", blacklistStartDate, blacklistEndDate]);
    
                // Blacklist the user from logging in
                const updateSql = 'UPDATE user_table SET is_blacklisted = ? WHERE user_id = ?';
                await db.query(updateSql, [1, userIdResult[0][0].user_id]);
            }
            
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
      } else{
        return res.json({ success: false, message: 'Reservation ID does not exist in the user'})
      }
      
    } catch (err) {
      console.error('Error:', err);
      return res.status(500).send('An error occurred while processing the request.');
    }
  });
  
// Endpoint to handle blacklist form submission
app.post('/blacklist-status', upload.none(), async (req, res) => {
    const { user_id, reason, blacklist_start, blacklist_end, status } = req.body;
  
    try {

        // Check if the user ID already exists in the blacklist table
        const [checkResult] = await db.query('SELECT * FROM blacklist_table WHERE user_id = ?', [user_id]);

        // Check if the user ID  exists in the user table
        const [checkUser] = await db.query('SELECT * FROM user_table WHERE user_id = ?', [user_id]);

        if(checkUser.length > 0){
            if (checkResult.length > 0) {
                // If user is already blacklisted, update or delete depending on status
                if (status == 0) {
                    // If status is 0, remove from blacklist
                    await db.query('DELETE FROM blacklist_table WHERE user_id = ?', [user_id]);
                    await db.query('UPDATE user_table SET is_blacklisted = 0 WHERE user_id = ?', [user_id]);
                    return res.json({ success: true, message: 'User removed from blacklist.' });
                } else {
                    // Convert dates to string format (YYYY-MM-DD) for MySQL compatibility
                    const blacklistStartDate = new Date(blacklist_start).toISOString().split('T')[0];
                    const blacklistEndDate = new Date(blacklist_end).toISOString().split('T')[0];
    
                    // If status is non-zero, update the blacklist details
                    await db.query(
                        'UPDATE blacklist_table SET reason = ?, blacklist_start = ?, blacklist_end = ? WHERE user_id = ?',
                        [reason, blacklistStartDate, blacklistEndDate, user_id]
                    );
                    await db.query('UPDATE user_table SET is_blacklisted = 1 WHERE user_id = ?', [user_id]);
                    return res.json({ success: true, message: 'Blacklist information updated successfully!' });
                }
            } else {
                // If the user is not found in the blacklist, insert a new record
                if (status !== 0) {
    
                    // Convert dates to string format (YYYY-MM-DD) for MySQL compatibility
                    const blacklistStartDate = new Date(blacklist_start).toISOString().split('T')[0];
                    const blacklistEndDate = new Date(blacklist_end).toISOString().split('T')[0];
                    console.log(blacklistStartDate)
    
                    await db.query(
                        'INSERT INTO blacklist_table (user_id, reason, blacklist_start, blacklist_end) VALUES (?, ?, ?, ?)',
                        [user_id, reason, blacklistStartDate, blacklistEndDate]
                    );
                    await db.query('UPDATE user_table SET is_blacklisted = 1 WHERE user_id = ?', [user_id]);
                    return res.json({ success: true, message: 'User added to blacklist.' });
                } else {
                    return res.status(400).json({ success: false, message: 'Cannot remove user from blacklist, they are not blacklisted.' });
                }
            }
        } else{
            return res.status(400).json({ success: false, message: 'User not found.'})
        }

        
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ success: false, message: 'An error occurred while processing the request.' });
    }
});

// Fetch status for a given class and date
app.post('/get-status', async (req, res) => {
    const { className, date } = req.body;

    try {
        // Check the status of the class in the classroom table
        const [checkStatus] = await db.query(
            'SELECT time, status FROM classroom_table WHERE class_name = ? AND date = ?', 
            [className, date]
        );

        // Send the fetched data back to the client
        return res.json({ success: true, data: checkStatus });
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ success: false, message: 'An error occurred while processing the request.' });
    }
});

app.post('/update-class-status', upload.none(), async (req, res) => {
    console.log('Request Body:', req.body);  // Log the entire request body
    const { classroomId, newStatus } = req.body;

    console.log(req.body)
  
    try {
      // Update status in the database
      await db.query('UPDATE classroom_table SET status = ? WHERE classroom_id = ?', [newStatus, classroomId]);
      res.json({ success: true, message: 'Classroom status updated successfully.' });

    } catch (error) {
      console.error('Error updating status:', error);
      res.json({ success: false });
    }
  });

// Export data to excel
app.get('/export-reservations', async (req, res) => {
    try {
        console.log("I am clicked")
      // Query to fetch reservation data
      const [rows] = await db.query('SELECT reservation_id, status, class_name, reservation_date, start_time, name, student_id, department, phone_number, purpose, number_of_students, user_id, email FROM reservation_table');
  
      // Define CSV file path
      const filePath = path.join(__dirname, 'exports', 'reservations.csv');
  
      // Ensure the exports directory exists
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath));
      }
  
      // Write data to a CSV file
      const headers = Object.keys(rows[0]).join(',') + '\n';
      const csvData = rows.map(row => Object.values(row).join(',')).join('\n');
  
      fs.writeFileSync(filePath, headers + csvData, {encoding: 'utf-8'});
  
      // Send the file to the user
      res.download(filePath, 'reservations.csv', err => {
        console.log('CSV file path:', filePath);
        if (err) {
          console.error('Error during download:', err);
          res.status(500).send('Error occurred while exporting data');
        }
      });
  
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).send('Failed to export data');
    }
  });