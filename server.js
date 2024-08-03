const express = require('express');
const mysql = require('mysql');
const { body, validationResult } = require('express-validator');
const bodyParser = require("body-parser")
const bcrypt = require('bcryptjs');
const saltRounds = 10; // Adjust the salt rounds as needed
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

require('dotenv').config();

const secretKey = process.env.JWT_SECRET_KEY;

app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); 

// Create MySQL connection
const database = mysql.createConnection({
    host: 'host.docker.internal',
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



// REGISTRATION
app.post('/api/register', (req, res) => {
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

                // Generate a JWT token
                const token = jwt.sign({ username }, secretKey, { expiresIn: '1h' });

                res.status(201).json({ message: 'User registered successfully', token });
            });
        });
    });
});


// AUTHENTICATION
app.get('/api/authenticate', (req, res) => {
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
                // Generate a JWT token
                const token = jwt.sign({ username: user.username }, secretKey, { expiresIn: '1h' });

                res.status(200).json({ message: 'Authentication successful', token });
            } else {
                res.status(401).json({ error: 'Invalid password' });
            }
        });
    });
});



// ADD TASKS
app.post('/api/tasks', (req, res) => {
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


// RETRIVE TASKS
app.get('/api/tasks', (req, res) => {

    const { status, priority, dueDate, search } = req.query;

    const queryParams = [];
    let query = 'SELECT * FROM tasks';

    // Add filters to query if any of them are provided
    if (status || priority || dueDate || search) {
        query += ' WHERE'; // Start the WHERE clause

        if (status) {
            query += ' status = ?';
            queryParams.push(status);
        }
        if (priority) {
            if (queryParams.length > 0) query += ' AND'; 
            query += ' priority = ?';
            queryParams.push(priority);
        }
        if (dueDate) {
            if (queryParams.length > 0) query += ' AND'; 
            query += ' due_date = ?'; 
            queryParams.push(dueDate);
        }
        if (search) {
            if (queryParams.length > 0) query += ' AND'; 
            query += ' (title LIKE ? OR description LIKE ?)';
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
        }
    }

    // Execute the query
    database.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        res.status(200).json(results);
    });
});



//UPDATE TASK
app.put('/api/tasks/:taskId', (req, res) => {
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


// DELETE TASK
app.delete('/api/tasks/:taskId', (req, res) => {
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
    res.send("Hi there !!!. This is a Task Manager App where you can manage and track your day to day tasks");
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at port: ${port}`);
});


