This repository contains the REST API implementation for a task manager, as specified in the assignment project by GoKapture. The application includes a Docker Compose configuration, but there due to configuration error i'm unable to access MySQL service from the Node.js app container.

Steps to Run the Project
1. Start the MySQL Container: Execute the following command to create and run the MySQL container, which listens on port 3306:
   cmd: docker run -p 3306:3306 --name nodejs-mysql -e MYSQL_ROOT_PASSWORD=Password -e MYSQL_DATABASE=task_manager_db -d mysql:5.7

2. Run the Node.js Application: Start the Node.js server by executing the following command:
   cmd: node server.js
This setup will initialize the MySQL container and start the Node.js application, providing the REST API functionality for managing tasks.

3. I've written some unit test cases to check each api, which will be found in task_manager.postman_collection json file.
