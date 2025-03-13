var express = require("express");
var app = express();
var bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
var mysql = require("mysql");
require("dotenv").config();

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
/// Add for upload image
let multer = require("multer");
let path = require("path");
//use express static folder
app.use(express.static("./public"));
app.use("/userApi/uploads", express.static("./uploads"));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// handle storage using multer
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      `/${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!["profile_picture", "id_card_img"].includes(file.fieldname)) {
      return cb(new Error("Unexpected field: " + file.fieldname));
    }
    cb(null, true);
  },
});

app.get("/", function (req, res) {
  return res.send({ error: false, message: "Test users Web API" });
});

var dbConn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

dbConn.connect();

const uploadFields = upload.fields([
  { name: "profile_picture", maxCount: 1 },
  { name: "id_card_img", maxCount: 1 },
]);
// Insert account
app.post("/insertAccount", uploadFields, async function (req, res) {
  console.log("Uploaded Files:", req.files);
  console.log("Request Body:", req.body);

  const post = req.body;
  const idUsers = post.idUsers;
  const fname_lname = post.fname_lname;
  const email = post.email;
  const address = post.address;
  const bank = post.bank;
  const account_number = post.account_number;
  const account_name = post.account_name;
  const password = post.password;
  const phone = post.phone;

  let role = post.role;
  if (!role) {
    role = "User";
  }

  const profile_picture = req.files?.["profile_picture"]?.[0]?.filename
    ? process.env.IMAGE_PATH + req.files?.["profile_picture"]?.[0]?.filename
    : "no image";
  const id_card_img = req.files?.["id_card_img"]?.[0]?.filename
    ? process.env.IMAGE_PATH + req.files["id_card_img"][0].filename
    : "no image";

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);
  console.log(password_hash);
  if (!post) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide user data" });
  }

  dbConn.query(
    "SELECT * FROM users WHERE idUsers = ?",
    [idUsers],
    function (error, results) {
      if (error) throw error;
      if (results.length) {
        return res
          .status(400)
          .send({
            error: true,
            message: "This users id is already in the database.",
          });
      } else {
        const insertData = role
          ? "INSERT INTO users(idUsers, fname_lname, email, address,bank,account_number,account_name,password,phone,profile_picture,id_card_img, role) VALUES (?, ?, ?, ?, ?,?,?,?,?,?,?,?)"
          : "INSERT INTO users(idUsers, fname_lname, email, address,bank,account_number,account_name,password,phone,profile_picture,id_card_img) VALUES (?, ?, ?, ?, ?,?,?,?,?,?,?)";

        const queryParams = role
          ? [
              idUsers,
              fname_lname,
              email,
              address,
              bank,
              account_number,
              account_name,
              password_hash,
              phone,
              profile_picture,
              id_card_img,
              "user",
            ]
          : [
              idUsers,
              fname_lname,
              email,
              address,
              bank,
              account_number,
              account_name,
              password_hash,
              phone,
              profile_picture,
              id_card_img,
            ];

        dbConn.query(insertData, queryParams, function (error, results) {
          if (error) throw error;
          return res.send(results);
        });
      }
    }
  );
});

// Login
app.post("/login", function (req, res) {
  const user = req.body;
  const email = user.email;
  const password = user.password;
  console.log(password);

  if (!email || !password) {
    return res
      .status(400)
      .send({
        error: true,
        message: "Please provide the user id and password.",
      });
  }

  dbConn.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    function (error, results) {
      if (error) throw error;
      console.log(results[0]);

      if (results[0]) {
        // Check if del_status is 'Y'
        if (results[0].del_status === 'Y') {
          return res.send({
            success: 0,
            message: "Your account is deactivated. Please contact support.",
          });
        }

        // Proceed with password comparison
        bcrypt.compare(password, results[0].password, function (error, result) {
          if (error) {
            console.log("Error during bcrypt compare:", error);
            return res
              .status(500)
              .send({ error: true, message: "Error comparing password" });
          }
          console.log("Password comparison result:", result); // ตรวจสอบค่าผลลัพธ์ที่ได้จากการเปรียบเทียบ
          console.log("Password from client:", password);
          console.log("Stored hash password:", results[0].password);

          if (result) {
            const fname_lname = results[0].fname_lname;

            return res.send({
              success: 1,
              idUsers: results[0].idUsers,
              role: results[0].role,
              fname_lname: results[0].fname_lname,
              address: results[0].address,
              bank: results[0].bank,
              account_number: results[0].account_number,
              account_name: results[0].account_name,
              // ส่งอีเมลกลับด้วย
              email: results[0].email,
            });
          } else {
            return res.send({ success: 0 });
          }
        });
      } else {
        return res.send({ success: 0 });
      }
    }
  );
});

// Login
// app.post("/login", function (req, res) {
//   const user = req.body;
//   const email = user.email;
//   const password = user.password;
//   console.log(password);

//   if (!email || !password) {
//     return res
//       .status(400)
//       .send({
//         error: true,
//         message: "Please provide the user id and password.",
//       });
//   }

//   dbConn.query(
//     "SELECT * FROM users WHERE email = ?",
//     [email],
//     function (error, results) {
//       if (error) throw error;
//       console.log(results[0]);
//       if (results[0]) {
//         bcrypt.compare(password, results[0].password, function (error, result) {
//           if (error) {
//             console.log("Error during bcrypt compare:", error);
//             return res
//               .status(500)
//               .send({ error: true, message: "Error comparing password" });
//           }
//           console.log("Password comparison result:", result); // ตรวจสอบค่าผลลัพธ์ที่ได้จากการเปรียบเทียบ
//           console.log("Password from client:", password);
//           console.log("Stored hash password:", results[0].password);
//           if (result) {
//             const fname_lname = results[0].fname_lname;

//             return res.send({
//               success: 1,
//               idUsers: results[0].idUsers,
//               role: results[0].role,
//               fname_lname: results[0].fname_lname,
//               address: results[0].address,
//               bank: results[0].bank,
//               account_number: results[0].account_number,
//               account_name: results[0].account_name,
//               // ส่งอีเมลกลับด้วย
//               email: results[0].email,
//             });
//           } else {
//             return res.send({ success: 0 });
//           }
//         });
//       } else {
//         return res.send({ success: 0 });
//       }
//     }
//   );
// });

// Search by student ID
app.get("/search/:idUsers", function (req, res) {
  const idUsers = req.params.idUsers;

  if (!idUsers) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide the user id" });
  }

  dbConn.query(
    "SELECT * FROM users WHERE idUsers = ?",
    [idUsers],
    function (error, results) {
      if (error) throw error;
      if (results[0]) {
        return res.send({
          idUsers: results[0].idUsers,
          fname_lname: results[0].fname_lname,
          email: results[0].email,
          address: results[0].address,
          bank: results[0].bank,
          account_number: results[0].account_number,
          account_name: results[0].account_name,
          password: results[0].password,
          phone: results[0].phone,
          profile_picture: results[0].profile_picture,
          id_card_img: results[0].id_card_img,
          role: results[0].role,
          createAt: results[0].createAt,
          deleteAt: results[0].deleteAt,
        });
      } else {
        return res
          .status(400)
          .send({ error: true, message: "Users id not found!!" });
      }
    }
  );
});

//แสดงผู้ใช้ทั้งหมด
app.get("/allUsers", function (req, res) {
  dbConn.query(
    "SELECT * FROM users ORDER BY idUsers DESC",
    function (error, results) {
      if (error) throw error;
      console.log("Data from DB:", results);
      return res.send(results);
    }
  );
});

// ดึงผู้ใช้ที่ถูกลบทั้งหมด
  app.get("/deletedusers", function (req, res) {
    let query = `
          SELECT * FROM users WHERE del_status = 'Y' ORDER BY idUsers DESC
      `;
  
    dbConn.query(query, function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      return res.send({
        error: false,
        data: results,
        message: "Deleted users retrieved successfully.",
      });
    });
  });

  //delete_softUsers
  app.put("/delete_softUsers/:userId", function (req, res) {
    let userId = req.params.userId;
    if (!userId) {
      return res
        .status(400)
        .send({ error: true, message: "Please provide userId" });
    }
    
      dbConn.query(
        "UPDATE users SET del_status = 'Y', deleteAt = NOW() WHERE idUsers = ?",
        [userId],
        function (error, results) {
          if (error) throw error;
          return res.send({
            error: false,
            data: results,
            message: "ลบผู้ใช้เรียบร้อยแล้ว",
          });
        }
      );
    })


// กู้คืนผู้ใช้
app.put("/restoreUsers/:idUsers", function (req, res) {
  dbConn.query(
    "UPDATE users SET del_status = 'N' WHERE idUsers = ?",
    [req.params.idUsers],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "ผู้ใช้ถูกกู้คืนเรียบร้อยแล้ว",
      });
    }
  );
});

// สำหรับค้นหาผู้ใช้ตาม fname_lname
app.get("/searchUsers", (req, res) => {
  const userSearch = req.query.fname_lname; // ใช้ req.query แทน req.params

  const query = "SELECT * FROM users WHERE fname_lname LIKE ?";
  dbConn.query(query, ["%" + userSearch + "%"], (err, results) => {
    if (err) {
      console.error("Error in query: " + err.stack);
      res.status(500).send("Error in query");
      return;
    }

    if (results.length > 0) {
      res.json(results);
    } else {
      res.status(200).json([]); // ส่ง Array ว่างแทน 404
    }
  });
});

app.get("/checkEmail/:email", function (req, res) {
  const email = req.params.email;
  dbConn.query(
    "SELECT idUsers FROM users WHERE email = ?",
    [email],
   function (error, results) {
      if (error) throw error;
      return res.send(results.length > 0);
    }
  );
});

app.listen(4000, function () {
  console.log("Node app is running on port 4000");
});

module.exports = app;
