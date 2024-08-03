const express = require('express');
const mysql = require('mysql');
const { body, validationResult } = require('express-validator');
const bodyParser = require("body-parser")
const bcrypt = require('bcrypt');
const saltRounds = 10; // Adjust the salt rounds as needed


const path = require('path');
const app = express();
const port = 3000;

require('dotenv').config();

app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); 

// Create MySQL connection
const database = mysql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

database.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database.');

    // Create the table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS Users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `;
    database.query(createTableQuery, (err, result) => {
        if (err) throw err;
        console.log('Table created or already exists.');
    });

    // Create the Tasks table if it doesn't exist
    const createTasksTableQuery = `
      CREATE TABLE IF NOT EXISTS Tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        status ENUM('Todo', 'In Progress', 'Done') NOT NULL,
        priority ENUM('Low', 'Medium', 'High') NOT NULL,
        due_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        user_id INT,
        FOREIGN KEY (user_id) REFERENCES Users(id)
      )
    `;
    database.query(createTasksTableQuery, (err, result) => {
        if (err) throw err;
        console.log('Tasks table created or already exists.');
    });
});



// POST route to handle registration
app.post('/register', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if the username already exists
    const checkQuery = 'SELECT * FROM Users WHERE username = ?';
    database.query(checkQuery, [username], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }

        if (results.length > 0) {
            // Username already exists
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash the password
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) {
                console.error('Error hashing password:', err);
                return res.status(500).json({ error: 'Password hashing failed' });
            }

            // Insert new user with hashed password
            const insertQuery = 'INSERT INTO Users (username, password) VALUES (?, ?)';
            database.query(insertQuery, [username, hash], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err);
                    return res.status(500).json({ error: 'Database insertion failed' });
                }
                res.status(201).json({ message: 'User registered successfully' });
            });
        });
    });
});



app.get('/authenticate', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if the username exists
    const checkQuery = 'SELECT * FROM Users WHERE username = ?';
    database.query(checkQuery, [username], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }

        if (results.length === 0) {
            // Username does not exist
            return res.status(404).json({ error: 'Username not found' });
        }

        const user = results[0];

        // Compare the hashed password
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).json({ error: 'Password comparison failed' });
            }

            if (result) {
                res.status(200).json({ message: 'Authentication successful' });
            } else {
                res.status(401).json({ error: 'Invalid password' });
            }
        });
    });
});



app.post('/tasks', (req, res) => {
    const { title, description, status, priority, due_date, username } = req.body;

    if (!title || !status || !username) {
        return res.status(400).json({ error: 'Title, status, and username are required' });
    }

    // Get user id from username
    const getUserIdQuery = 'SELECT id FROM Users WHERE username = ?';
    database.query(getUserIdQuery, [username], (err, results) => {
        if (err) {
            console.error('Error querying user:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = results[0].id;

        // Insert new task
        const insertTaskQuery = 'INSERT INTO Tasks (title, description, status, priority, due_date, user_id) VALUES (?, ?, ?, ?, ?, ?)';
        database.query(insertTaskQuery, [title, description, status, priority, due_date, userId], (err, result) => {
            if (err) {
                console.error('Error inserting task:', err);
                return res.status(500).json({ error: 'Database insertion failed' });
            }
            res.status(201).json({message: "Task successful created"});

            
        });
    });
});

app.get('/tasks', (req, res) => {
    const selectTasksQuery = 'SELECT * FROM Tasks';
    database.query(selectTasksQuery, (err, results) => {
        if (err) {
            console.error('Error querying tasks:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        res.status(200).json(results);
    });
});


app.put('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    const { title, description, status, priority, due_date } = req.body;

    const updateTaskQuery = 'UPDATE Tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ? WHERE id = ?';
    database.query(updateTaskQuery, [title, description, status, priority, due_date, taskId], (err, result) => {
        if (err) {
            console.error('Error updating task:', err);
            return res.status(500).json({ error: 'Database update failed' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.status(200).json({ message: 'Task updated successfully' });
    });
});

app.delete('/tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;

    const deleteTaskQuery = 'DELETE FROM Tasks WHERE id = ?';
    database.query(deleteTaskQuery, [taskId], (err, result) => {
        if (err) {
            console.error('Error deleting task:', err);
            return res.status(500).json({ error: 'Database deletion failed' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.status(200).json({ message: 'Task deleted successfully' });
    });
});









// Root route
app.get('/', (req, res) => {
    res.send("Hi there");
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at port: ${port}`);
});


// const express = require('express');
// const path = require('path');

// const app = express();

// // Middleware to parse URL-encoded bodies (form submissions)
// app.use(express.urlencoded({ extended: true }));

// // Serve the HTML file
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

// // Handle form submissions
// app.post('/', (req, res) => {
//     console.log('Request body:', req.body);

//     const username = req.body.num1;
//     const password = req.body.num2;

//     if (!username || !password) {
//         return res.status(400).json({ error: 'Username and password are required' });
//     }

//     // Perform some operation with the data (example: addition)
//     const num1 = Number(username);
//     const num2 = Number(password);
//     const result = num1 + num2;

//     res.send(`Addition - ${result}`);
// });

// app.listen(3000, () => {
//     console.log('Server is running on port 3000');
// });
