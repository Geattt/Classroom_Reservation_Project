const express = require("express")
const app = express()
const cors = require('cors');
app.use(cors());
const mysql = require("mysql2/promise")

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



