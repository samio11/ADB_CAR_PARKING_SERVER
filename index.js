const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors"); // Added CORS middleware for cross-origin requests
const app = express();
const port = 3000;

// Initialize Oracle Client
oracledb.initOracleClient({
  libDir: "C:\\oraclexe\\app\\oracle\\instantclient_11_2",
}); // Update the path as needed

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Database Connection Setup
const getConnection = async () => {
  return await oracledb.getConnection({
    user: "sys",
    password: "admin", // Replace with your SYS password
    connectString: "samio:1521/XE",
    privilege: oracledb.SYSDBA,
  });
};

// Default Route
app.get("/", (req, res) => {
  res.send("Server is running successfully!");
});

/** -------------------- Authentication and User Management -------------------- **/

// Login a User
app.post("/login", async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).send("Both email and role are required.");
  }

  try {
    const connection = await getConnection();

    // Define table based on role
    let tableName;
    switch (role.toLowerCase()) {
      case "admin":
        tableName = "Admin";
        break;
      case "customer":
        tableName = "Customer";
        break;
      case "developer":
        tableName = "Developer";
        break;
      case "account manager":
        tableName = "Account_Manager";
        break;
      default:
        return res.status(400).send("Invalid role provided.");
    }

    // Query to check if the email exists in the specified table
    const query = `SELECT * FROM ${tableName} WHERE email = :email`;
    const result = await connection.execute(query, { email });

    if (result.rows.length === 0) {
      return res.status(404).send("Invalid email or role.");
    }

    const user = result.rows[0];
    const formattedUser = result.metaData.reduce((acc, meta, index) => {
      acc[meta.name] = user[index];
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: formattedUser,
    });

    await connection.close();
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Error logging in.");
  }
});

// Register a New Customer
app.post("/register", async (req, res) => {
  const { customer_id, first_name, last_name, phone_number, email, address } =
    req.body;

  if (
    !customer_id ||
    !first_name ||
    !last_name ||
    !phone_number ||
    !email ||
    !address
  ) {
    return res
      .status(400)
      .send(
        "All fields (customer_id, first_name, last_name, phone_number, email, and address) are required."
      );
  }

  try {
    const connection = await getConnection();

    const query = `
      INSERT INTO Customer (customer_id, first_name, last_name, phone_number, email, address) 
      VALUES (:customer_id, :first_name, :last_name, :phone_number, :email, :address)
    `;
    await connection.execute(
      query,
      { customer_id, first_name, last_name, phone_number, email, address },
      { autoCommit: true }
    );

    res.status(201).json({ message: "Customer registered successfully!" });

    await connection.close();
  } catch (error) {
    console.error("Error registering customer:", error);
    res.status(500).send(`Error registering customer: ${error.message}`);
  }
});

/** -------------------- Generic CRUD Operations -------------------- **/

// 4. Insert into a Table
app.post("/:table", async (req, res) => {
  const { table } = req.params;
  const data = req.body;

  try {
    const connection = await getConnection();
    const fields = Object.keys(data).join(", ");
    const values = Object.keys(data)
      .map((key) => `:${key}`)
      .join(", ");
    const query = `INSERT INTO ${table} (${fields}) VALUES (${values})`;

    await connection.execute(query, data, { autoCommit: true });
    res.send(`Data inserted into ${table} successfully!`);

    await connection.close();
  } catch (error) {
    console.error(`Error inserting into ${table}:`, error);
    res.status(500).send(`Error inserting into ${table}: ${error.message}`);
  }
});

// 5. Update a Table by ID
app.put("/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const data = req.body;

  try {
    const connection = await getConnection();
    const updates = Object.keys(data)
      .map((key) => `${key} = :${key}`)
      .join(", ");
    const primaryKey = `${table.toLowerCase()}_id`; // Assuming primary key naming convention is table_id
    const query = `UPDATE ${table} SET ${updates} WHERE ${primaryKey} = :id`;

    await connection.execute(query, { ...data, id }, { autoCommit: true });
    res.send(`Data in ${table} with ID ${id} updated successfully!`);

    await connection.close();
  } catch (error) {
    console.error(`Error updating ${table}:`, error);
    res.status(500).send(`Error updating ${table}: ${error.message}`);
  }
});

// 6. Get All Data from a Table
app.get("/:table", async (req, res) => {
  const { table } = req.params;

  try {
    const connection = await getConnection();
    const result = await connection.execute(`SELECT * FROM ${table}`);

    // Map rows to column names
    const formattedResult = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name] = value;
        return acc;
      }, {})
    );

    res.json(formattedResult);

    await connection.close();
  } catch (error) {
    console.error(`Error fetching data from ${table}:`, error);
    res.status(500).send(`Error fetching data from ${table}: ${error.message}`);
  }
});

// 7. Delete Data by ID
app.delete("/:table/:id", async (req, res) => {
  const { table, id } = req.params;

  try {
    const connection = await getConnection();
    const primaryKey = `${table.toLowerCase()}_id`; // Assuming primary key naming convention is table_id
    const query = `DELETE FROM ${table} WHERE ${primaryKey} = :id`;

    await connection.execute(query, { id }, { autoCommit: true });
    res.send(`Data in ${table} with ID ${id} deleted successfully!`);

    await connection.close();
  } catch (error) {
    console.error(`Error deleting data from ${table}:`, error);
    res.status(500).send(`Error deleting data from ${table}: ${error.message}`);
  }
});

// Customer Part
// Get customer details by ID
app.get("/customers/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `SELECT * FROM Customer WHERE customer_id = :id`;
    const result = await connection.execute(query, { id });

    if (result.rows.length === 0) {
      return res.status(404).send("Customer not found.");
    }

    const customer = result.rows[0];
    const formattedCustomer = result.metaData.reduce((acc, meta, index) => {
      acc[meta.name.toLowerCase()] = customer[index];
      return acc;
    }, {});

    res.json(formattedCustomer);
    await connection.close();
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).send("Error fetching customer.");
  }
});

// Add a new reservation
app.post("/reservations", async (req, res) => {
  const {
    reservation_id,
    customer_id,
    reservation_date,
    start_time,
    end_time,
    slot_number,
  } = req.body;

  if (
    !reservation_id ||
    !customer_id ||
    !reservation_date ||
    !start_time ||
    !end_time ||
    !slot_number
  ) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      INSERT INTO Reservation (reservation_id, customer_id, reservation_date, start_time, end_time, slot_number)
      VALUES (:reservation_id, :customer_id, :reservation_date, :start_time, :end_time, :slot_number)
    `;
    await connection.execute(
      query,
      {
        reservation_id,
        customer_id,
        reservation_date,
        start_time,
        end_time,
        slot_number,
      },
      { autoCommit: true }
    );

    res.status(201).send("Reservation added successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error adding reservation:", error);
    res.status(500).send("Error adding reservation.");
  }
});

// Get reservations for a customer
app.get("/reservations/:customer_id", async (req, res) => {
  const { customer_id } = req.params;

  try {
    const connection = await getConnection();
    const query = `SELECT * FROM Reservation WHERE customer_id = :customer_id`;
    const result = await connection.execute(query, { customer_id });

    const reservations = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toLowerCase()] = value;
        return acc;
      }, {})
    );

    res.json(reservations);
    await connection.close();
  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).send("Error fetching reservations.");
  }
});

// Update a reservation
app.put("/reservations/:id", async (req, res) => {
  const { id } = req.params;
  const { reservation_date, start_time, end_time, slot_number } = req.body;

  try {
    const connection = await getConnection();
    const query = `
      UPDATE Reservation
      SET reservation_date = :reservation_date, start_time = :start_time, end_time = :end_time, slot_number = :slot_number
      WHERE reservation_id = :id
    `;
    await connection.execute(
      query,
      { reservation_date, start_time, end_time, slot_number, id },
      { autoCommit: true }
    );

    res.send("Reservation updated successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error updating reservation:", error);
    res.status(500).send("Error updating reservation.");
  }
});

// Delete a reservation
app.delete("/reservations/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `DELETE FROM Reservation WHERE reservation_id = :id`;
    await connection.execute(query, { id }, { autoCommit: true });

    res.send("Reservation deleted successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error deleting reservation:", error);
    res.status(500).send("Error deleting reservation.");
  }
});

// Add a new vehicle
app.post("/vehicles", async (req, res) => {
  const { vehicle_id, customer_id, license_plate, model, color } = req.body;

  if (!vehicle_id || !customer_id || !license_plate || !model || !color) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      INSERT INTO Vehicle (vehicle_id, customer_id, license_plate, model, color)
      VALUES (:vehicle_id, :customer_id, :license_plate, :model, :color)
    `;
    await connection.execute(
      query,
      { vehicle_id, customer_id, license_plate, model, color },
      { autoCommit: true }
    );

    res.status(201).send("Vehicle added successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error adding vehicle:", error);
    res.status(500).send("Error adding vehicle.");
  }
});

// Get vehicles for a customer
app.get("/vehicles/:customer_id", async (req, res) => {
  const { customer_id } = req.params;

  try {
    const connection = await getConnection();
    const query = `SELECT * FROM Vehicle WHERE customer_id = :customer_id`;
    const result = await connection.execute(query, { customer_id });

    const vehicles = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toLowerCase()] = value;
        return acc;
      }, {})
    );

    res.json(vehicles);
    await connection.close();
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).send("Error fetching vehicles.");
  }
});

// Update a vehicle
app.put("/vehicles/:id", async (req, res) => {
  const { id } = req.params;
  const { license_plate, model, color } = req.body;

  try {
    const connection = await getConnection();
    const query = `
      UPDATE Vehicle
      SET license_plate = :license_plate, model = :model, color = :color
      WHERE vehicle_id = :id
    `;
    await connection.execute(
      query,
      { license_plate, model, color, id },
      { autoCommit: true }
    );

    res.send("Vehicle updated successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).send("Error updating vehicle.");
  }
});

// Delete a vehicle
app.delete("/vehicles/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `DELETE FROM Vehicle WHERE vehicle_id = :id`;
    await connection.execute(query, { id }, { autoCommit: true });

    res.send("Vehicle deleted successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    res.status(500).send("Error deleting vehicle.");
  }
});

// Admin
/** -------------------- Admin Management -------------------- **/

// Create Admin
app.post("/admin", async (req, res) => {
  const { first_name, last_name, phone_number, email, role } = req.body;

  if (!first_name || !last_name || !phone_number || !email || !role) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      INSERT INTO admin (first_name, last_name, phone_number, email, role)
      VALUES (:first_name, :last_name, :phone_number, :email, :role)
    `;
    await connection.execute(
      query,
      { first_name, last_name, phone_number, email, role },
      { autoCommit: true }
    );
    res.status(201).send("Admin added successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error adding admin:", error);
    res.status(500).send("Error adding admin: " + error.message);
  }
});

// Read All Admins
app.get("/admin", async (req, res) => {
  try {
    const connection = await getConnection();
    const query = `SELECT * FROM admin`;
    const result = await connection.execute(query);

    const admins = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toLowerCase()] = value;
        return acc;
      }, {})
    );

    res.json(admins);
    await connection.close();
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).send("Error fetching admins: " + error.message);
  }
});

// Update Admin
app.put("/admin/:id", async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone_number, email, role } = req.body;

  try {
    const connection = await getConnection();
    const query = `
      UPDATE admin
      SET first_name = :first_name, last_name = :last_name, phone_number = :phone_number, email = :email, role = :role
      WHERE admin_id = :id
    `;
    await connection.execute(
      query,
      { first_name, last_name, phone_number, email, role, id },
      { autoCommit: true }
    );
    res.send("Admin updated successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).send("Error updating admin: " + error.message);
  }
});

// Delete Admin
app.delete("/admin/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `DELETE FROM admin WHERE admin_id = :id`;
    await connection.execute(query, { id }, { autoCommit: true });
    res.send("Admin deleted successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).send("Error deleting admin: " + error.message);
  }
});

/** -------------------- Parking Slot Management -------------------- **/

// Create Parking Slot
app.post("/parking_slot", async (req, res) => {
  const { location, floor, section, slot_number, status, price } = req.body;

  if (!location || !floor || !section || !slot_number || !status) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      INSERT INTO parking_slot (location, floor, section, slot_number, status, price)
      VALUES (:location, :floor, :section, :slot_number, :status, :price)
    `;
    await connection.execute(
      query,
      { location, floor, section, slot_number, status, price },
      { autoCommit: true }
    );
    res.status(201).send("Parking slot added successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error adding parking slot:", error);
    res.status(500).send("Error adding parking slot: " + error.message);
  }
});

// Read All Parking Slots
app.get("/parking_slot", async (req, res) => {
  try {
    const connection = await getConnection();
    const query = `SELECT * FROM parking_slot`;
    const result = await connection.execute(query);

    const parkingSlots = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toLowerCase()] = value;
        return acc;
      }, {})
    );

    res.json(parkingSlots);
    await connection.close();
  } catch (error) {
    console.error("Error fetching parking slots:", error);
    res.status(500).send("Error fetching parking slots: " + error.message);
  }
});

// Update Parking Slot
app.put("/parking_slot/:id", async (req, res) => {
  const { id } = req.params;
  const { location, floor, section, slot_number, status, price } = req.body;

  try {
    const connection = await getConnection();
    const query = `
      UPDATE parking_slot
      SET location = :location, floor = :floor, section = :section, slot_number = :slot_number, status = :status, price = :price
      WHERE slot_id = :id
    `;
    await connection.execute(
      query,
      { location, floor, section, slot_number, status, price, id },
      { autoCommit: true }
    );
    res.send("Parking slot updated successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error updating parking slot:", error);
    res.status(500).send("Error updating parking slot: " + error.message);
  }
});

// Delete Parking Slot
app.delete("/parking_slot/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `DELETE FROM parking_slot WHERE slot_id = :id`;
    await connection.execute(query, { id }, { autoCommit: true });
    res.send("Parking slot deleted successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error deleting parking slot:", error);
    res.status(500).send("Error deleting parking slot: " + error.message);
  }
});

/** -------------------- Payment Monitoring -------------------- **/

// Read All Payments
app.get("/payment", async (req, res) => {
  try {
    const connection = await getConnection();
    const query = `SELECT * FROM payment`;
    const result = await connection.execute(query);

    const payments = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toLowerCase()] = value;
        return acc;
      }, {})
    );

    res.json(payments);
    await connection.close();
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).send("Error fetching payments: " + error.message);
  }
});

// Create Account Manager
app.post("/account_manager", async (req, res) => {
  const { first_name, last_name, email, role } = req.body;

  if (!first_name || !last_name || !email || !role) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      INSERT INTO account_manager (first_name, last_name, email, role)
      VALUES (:first_name, :last_name, :email, :role)
    `;
    await connection.execute(
      query,
      { first_name, last_name, email, role },
      { autoCommit: true }
    );
    res.status(201).send("Account Manager added successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error adding account manager:", error);
    res.status(500).send("Error adding account manager: " + error.message);
  }
});

// Read All Account Managers
app.get("/account_manager", async (req, res) => {
  try {
    const connection = await getConnection();
    const query = `SELECT * FROM account_manager`;
    const result = await connection.execute(query);

    const managers = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toLowerCase()] = value;
        return acc;
      }, {})
    );

    res.json(managers);
    await connection.close();
  } catch (error) {
    console.error("Error fetching account managers:", error);
    res.status(500).send("Error fetching account managers: " + error.message);
  }
});

// Update Account Manager
app.put("/account_manager/:id", async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, role } = req.body;

  if (!first_name || !last_name || !email || !role) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      UPDATE account_manager
      SET first_name = :first_name, last_name = :last_name, email = :email, role = :role
      WHERE manager_id = :id
    `;
    await connection.execute(
      query,
      { first_name, last_name, email, role, id },
      { autoCommit: true }
    );
    res.send("Account Manager updated successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error updating account manager:", error);
    res.status(500).send("Error updating account manager: " + error.message);
  }
});

// Delete Account Manager
app.delete("/account_manager/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `DELETE FROM account_manager WHERE manager_id = :id`;
    await connection.execute(query, { id }, { autoCommit: true });
    res.send("Account Manager deleted successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error deleting account manager:", error);
    res.status(500).send("Error deleting account manager: " + error.message);
  }
});

/** -------------------- Developer Management -------------------- **/

// Create Developer
app.post("/developer", async (req, res) => {
  const { first_name, last_name, email, assigned_project } = req.body;

  if (!first_name || !last_name || !email || !assigned_project) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const connection = await getConnection();
    const query = `
      INSERT INTO developer (first_name, last_name, email, assigned_project)
      VALUES (:first_name, :last_name, :email, :assigned_project)
    `;
    await connection.execute(
      query,
      { first_name, last_name, email, assigned_project },
      { autoCommit: true }
    );
    res.status(201).send("Developer added successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error adding developer:", error);
    res.status(500).send("Error adding developer: " + error.message);
  }
});

// Read All Developers
app.get("/developer", async (req, res) => {
  try {
    const connection = await getConnection();
    const query = `SELECT * FROM developer`;
    const result = await connection.execute(query);

    const developers = result.rows.map((row) =>
      row.reduce((acc, value, index) => {
        acc[result.metaData[index].name.toUpperCase()] = value;
        return acc;
      }, {})
    );

    res.json(developers);
    await connection.close();
  } catch (error) {
    console.error("Error fetching developers:", error);
    res.status(500).send("Error fetching developers: " + error.message);
  }
});

// Update Developer
app.put("/developer/:id", async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, assigned_project } = req.body;

  try {
    const connection = await getConnection();
    const query = `
      UPDATE developer
      SET first_name = :first_name, last_name = :last_name, email = :email, assigned_project = :assigned_project
      WHERE developer_id = :id
    `;
    await connection.execute(
      query,
      { first_name, last_name, email, assigned_project, id },
      { autoCommit: true }
    );
    res.send("Developer updated successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error updating developer:", error);
    res.status(500).send("Error updating developer: " + error.message);
  }
});

// Delete Developer
app.delete("/developer/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await getConnection();
    const query = `DELETE FROM developer WHERE developer_id = :id`;
    await connection.execute(query, { id }, { autoCommit: true });
    res.send("Developer deleted successfully!");
    await connection.close();
  } catch (error) {
    console.error("Error deleting developer:", error);
    res.status(500).send("Error deleting developer: " + error.message);
  }
});

/** -------------------- Start the Server -------------------- **/

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
