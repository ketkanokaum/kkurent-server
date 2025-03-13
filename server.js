var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mysql = require("mysql");
require("dotenv").config();

/// Add for upload image
let multer = require("multer");
let path = require("path");
//use express static folder
app.use(express.static("./public"));
app.use("/kkurentApi/uploads", express.static("./uploads"));
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
      `${file.fieldname}-
    ${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
var upload = multer({ storage: storage });

app.get("/", function (req, res) {
  return res.send({ error: false, message: "Test kkurentApi Web API" });
});

var dbConn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

dbConn.connect();

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

var upload = multer({ storage: storage });

app.get("/allpost", function (req, res) {
  // คำสั่ง SQL สำหรับดึงข้อมูลโพสต์และข้อมูลผู้ใช้ที่เกี่ยวข้อง
  let query = `
        SELECT post.*, users.fname_lname, users.profile_picture
        FROM post 
        LEFT JOIN users ON post.user_id = users.idUsers
        WHERE post.del_status = 'N' AND post.approve_status = 'Y'
        ORDER BY post.idPost DESC
    `;

  // เรียกใช้การเชื่อมต่อฐานข้อมูลเพื่อดำเนินการคำสั่ง SQL
  dbConn.query(query, function (err, results) {
    if (err) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล: ", err);
      return res
        .status(500)
        .send({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล", error: err });
    }

    // ส่งผลลัพธ์กลับไปยังผู้เรียก
    res.json(results);
  });
});

// โพตต์ของฉัน
app.get("/allpost/:idUsers", function (req, res) {
  let query = `SELECT post.*, users.fname_lname, users.profile_picture FROM post
     LEFT JOIN users ON post.user_id = users.idUsers WHERE user_id = ? AND post.del_status = 'N' AND post.approve_status = 'Y' ORDER BY post.idPost DESC`;
  dbConn.query(query, req.params.idUsers, function (error, results) {
    if (error) {
      console.error("Database query error:", error);
      return res.status(500).send({ message: "Database error", error: error });
    }
    return res.json(results);
  });
});

app.post("/post", function (req, res) {
  var post = req.body;

  if (!post) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide post data" });
  }

  dbConn.query(
    "INSERT INTO post SET ?",
    post,
    function (error, results, fields) {
      if (error) throw error;
      return res.send(results);
    }
  );
});

//สร้างโพสต์ตามหาสินค้า
app.post("/insertUpload", upload.single("image"), (req, res) => {
  const post_detail = req.body.post_detail;
  const fileImage = req.file; // ใช้ req.file ไม่ใช่ req.body.file
  const user_id = req.body.user_id;

  // ตรวจสอบว่ามีรายละเอียดโพสต์ไหม
  if (!post_detail || !user_id) {
    return res.status(400).send({ message: "กรุณากรอกรายละเอียดโพสต์" });
  }

  console.log("fileImage", fileImage);

  if (!fileImage) {
    console.log("No file upload");
  } else {
    var imgsrc = process.env.IMAGE_PATH + fileImage.filename;
  }

  // ใช้ user_id เพื่อค้นหา fname_lname จากฐานข้อมูล
  const queryGetFnameLname = "SELECT fname_lname FROM users WHERE idUsers = ?";

  dbConn.query(queryGetFnameLname, [user_id], (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).send({ message: "Database error", error: err });
    }

    if (result.length === 0) {
      return res.status(404).send({ message: "ไม่พบผู้ใช้ที่ระบุ" });
    }

    const fname_lname = result[0].fname_lname;

    // ตอนนี้เรามี fname_lname แล้ว
    const insertData =
      "INSERT INTO post(post_detail, post_img, user_id, createAt) VALUES (?, ?, (SELECT idUsers FROM users WHERE fname_lname = ?), NOW())";

    dbConn.query(
      insertData,
      [post_detail, imgsrc, fname_lname],
      (err, result) => {
        if (err) {
          console.error("Database insert error:", err);
          return res
            .status(500)
            .send({ message: "Database error", error: err });
        }

        console.log("File uploaded successfully");
        return res.send({
          message: "File successfully uploaded",
          fileImage,
        });
      }
    );
  });
});

// Update
app.put("/updatePost/:idPost", function (req, res) {
  let idPost = req.params.idPost;
  let post = req.body;

  if (!idPost || !post) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide correct data" });
  }

  dbConn.query(
    "UPDATE post SET ? WHERE idPost = ?",
    [post, idPost],
    function (error, results, fields) {
      if (error) {
        console.error("Update error:", error);
        return res
          .status(500)
          .send({ error: true, message: "Database error", details: error });
      }
      return res.send({
        error: false,
        data: results,
        message: "Post updated successfully.",
      });
    }
  );
});

app.put("/editUploadPost/:idPost", upload.any(), (req, res) => {
  console.log("Received files:", req.files);
  console.log("Received body:", req.body);

  const { post_detail } = req.body;
  const idPost = req.params.idPost;
  const fileImage = req.files.length > 0 ? req.files[0] : null;

  if (!idPost || !post_detail) {
    return res
      .status(400)
      .send({ error: "idPost และ post_detail ต้องไม่เป็นค่าว่าง" });
  }

  let updateQuery;
  let queryParams;

  if (fileImage) {
    const imgsrc = `${process.env.IMAGE_PATH}${fileImage.filename}`;
    updateQuery =
      "UPDATE post SET post_detail = ?, post_img = ? WHERE idPost = ?";
    queryParams = [post_detail, imgsrc, idPost];
  } else {
    updateQuery = "UPDATE post SET post_detail = ? WHERE idPost = ?";
    queryParams = [post_detail, idPost];
  }

  dbConn.query(updateQuery, queryParams, (err, result) => {
    if (err) {
      console.error("SQL Error: ", err);
      return res.status(500).send({ error: "Database error" });
    }
    console.log("Post updated successfully!", result);
    return res.send({
      message: "Post updated successfully",
      affectedRows: result.affectedRows,
    });
  });
});

app.put("/editUpload", upload.any("image"), (req, res) => {
  console.log("Received body:", req.body);
  console.log("Received file:", req.file);

  let { idPost, post_detail } = req.body;
  let fileImage = req.file;

  if (!idPost || !post_detail) {
    return res
      .status(400)
      .send({ error: "idPost และ post_detail ต้องไม่เป็นค่าว่าง" });
  }

  let updateQuery;
  let queryParams;

  if (fileImage) {
    let imgsrc = process.env.IMAGE_PATH + fileImage.filename;
    updateQuery =
      "UPDATE post SET post_detail = ?, post_img = ? WHERE idPost = ?";
    queryParams = [post_detail, imgsrc, idPost];
  } else {
    updateQuery = "UPDATE post SET post_detail = ? WHERE idPost = ?";
    queryParams = [post_detail, idPost];
  }

  dbConn.query(updateQuery, queryParams, (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).send({ error: "Database error" });
    }
    console.log("Post updated successfully", result);
    return res.send({
      message: "Post updated successfully",
      affectedRows: result.affectedRows,
    });
  });
});

//แอดมินลบโพสต์ตามหาสินค้า
app.put("/delete_softPost/:idPost", function (req, res) {
  let idPost = req.params.idPost;
  if (!idPost) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide idPost" });
  }

  dbConn.query(
    "UPDATE post SET del_status = 'Y', deleteAt = NOW() WHERE idPost = ?",
    [idPost],
    function (error, results, fields) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "ลบโพสต์เรียบร้อยแล้ว",
      });
    }
  );
});

//แสดงสินค้าที่ปล่อยเช่าทั้งหมด
app.get("/allitems", function (req, res) {
  let query = `
        SELECT items.*, category.category_name , users.fname_lname, users.email, users.profile_picture
        FROM items 
        LEFT JOIN category ON items.idCategory = category.idCategory
        LEFT JOIN users ON items.user_id = users.idUsers
        WHERE items.del_status = 'N' AND items.approve_status = 'Y'
        ORDER BY items.idItems DESC
    `;
  dbConn.query(query, function (error, results, fields) {
    if (error) throw error;
    console.log("Data from DB:", results);
    return res.send(results);
  });
});

//แสดงสินค้าที่ปล่อยเช่าทั้งหมดของฉัน
app.get("/allitems/:idUsers", function (req, res) {
  let query = `
        SELECT items.*, category.category_name, users.fname_lname, users.email, users.profile_picture
        FROM items 
        LEFT JOIN users ON items.user_id = users.idUsers
        LEFT JOIN category ON items.idCategory = category.idCategory WHERE user_id = ? AND items.del_status = 'N' AND items.approve_status = 'Y' ORDER BY items.idItems DESC
    `;
  dbConn.query(query, [req.params.idUsers], function (error, results, fields) {
    if (error) throw error;
    console.log("Data from DB:", results);
    return res.send(results);
  });
});

//สร้างโพสต์ปล่อยสินค้าให้เช่า
app.post("/insertItems", upload.single("image"), async function (req, res) {
  const {
    item_name,
    item_detail,
    price,
    location,
    item_status,
    user_id,
    category_name,
  } = req.body;
  const fileImage = req.file;

  if (
    !item_name ||
    !item_detail ||
    !price ||
    !location ||
    !item_status ||
    !category_name ||
    !user_id
  ) {
    return res.status(400).send({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  // ตรวจสอบว่ามีไฟล์หรือไม่
  let imgsrc = null;
  if (fileImage) {
    imgsrc = process.env.IMAGE_PATH + fileImage.filename;
  } else {
    console.log("No file uploaded");
  }

  // ดึง fname_lname และ idCategory จากฐานข้อมูล
  const queryGetUser = "SELECT fname_lname FROM users WHERE idUsers = ?";
  const queryGetCategory =
    "SELECT idCategory FROM category WHERE category_name = ?";

  dbConn.query(queryGetUser, [user_id], (err, userResult) => {
    if (err) {
      console.error("Error retrieving user:", err);
      return res
        .status(500)
        .send({ message: "Error retrieving user", error: err });
    }

    if (userResult.length === 0) {
      return res.status(400).send({ error: "User not found" });
    }

    const fnameLname = userResult[0].fname_lname;

    dbConn.query(queryGetCategory, [category_name], (err, categoryResult) => {
      if (err) {
        console.error("Error retrieving category:", err);
        return res
          .status(500)
          .send({ message: "Error retrieving category", error: err });
      }

      if (categoryResult.length === 0) {
        return res.status(400).send({ error: "Category not found" });
      }

      const idCategory = categoryResult[0].idCategory;

      // Query สำหรับการแทรกข้อมูลสินค้า
      const insertData = `
                INSERT INTO items (item_name, item_detail, price, item_img, location, item_status, user_id, idCategory, createAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
      const queryParams = [
        item_name,
        item_detail,
        price,
        imgsrc,
        location,
        item_status,
        user_id,
        idCategory,
      ];

      dbConn.query(insertData, queryParams, (err, result) => {
        if (err) {
          console.error("Database insert error:", err);
          return res
            .status(500)
            .send({ message: "Database error", error: err });
        }

        return res.send({
          message: "Item successfully added",
          item_id: result.insertId,
          item_name: item_name,
          fname_lname: fnameLname, // ส่งชื่อ-นามสกุลที่ค้นหาจากผู้ใช้
          category_name: category_name,
        });
      });
    });
  });
});

// ดึงสินค้าที่รออนุมัติทั้งหมด
app.get("/needapproveitems", function (req, res) {
  let query = `
        SELECT items.*, category.category_name , users.fname_lname, users.email
        FROM items 
        LEFT JOIN category ON items.idCategory = category.idCategory
        LEFT JOIN users ON items.user_id = users.idUsers
        WHERE items.del_status = 'N' AND items.approve_status = 'N'
        ORDER BY items.idItems DESC
    `;
  dbConn.query(query, function (error, results, fields) {
    if (error) throw error;
    console.log("Data from DB:", results);
    return res.send({
      error: false,
      data: results,
      message: "Deleted posts retrieved successfully.",
    });
  });
});

// ดึงโพสต์ที่รออนุมัติทั้งหมด
app.get("/needapproveposts", function (req, res) {
  let query = `
    SELECT post.*, users.fname_lname, users.profile_picture
    FROM post
    LEFT JOIN users ON post.user_id = users.idUsers
    WHERE post.del_status = 'N' AND post.approve_status = 'N'
    ORDER BY post.idPost DESC
    `;
  dbConn.query(query, function (error, results, fields) {
    if (error) throw error;
    console.log("Data from DB:", results);
    return res.send({
      error: false,
      data: results,
      message: "Deleted posts retrieved successfully.",
    });
  });
});

// อนุมัติโพสต์
app.put("/approvePost/:postId", function (req, res) {
  console.log(req.params.postId);
  dbConn.query(
    "UPDATE post SET approve_status = 'Y' WHERE idPost = ?",
    [req.params.postId],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "โพสต์ถูกอนุมัติเรียบร้อยแล้ว",
      });
    }
  );
});

// ไม่อนุมัติโพสต์
app.delete("/disapprovePost/:postId", function (req, res) {
  console.log(req.params.postId);
  dbConn.query(
    "DELETE FROM post WHERE idPost = ?",
    [req.params.postId],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "โพสต์ถูกลบเรียบร้อยแล้ว",
      });
    }
  );
});

// อนุมัติสินค้า
app.put("/approveProduct/:productId", function (req, res) {
  console.log(req.params.productId);
  dbConn.query(
    "UPDATE items SET approve_status = 'Y' WHERE idItems = ?",
    [req.params.productId],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "สินค้าถูกอนุมัติเรียบร้อยแล้ว",
      });
    }
  );
});

// ไม่อนุมัติสินค้า
app.delete("/disapproveProduct/:productId", function (req, res) {
  console.log(req.params.productId);
  dbConn.query(
    "DELETE FROM items WHERE idItems = ?",
    [req.params.productId],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "สินค้าถูกลบเรียบร้อยแล้ว",
      });
    }
  );
});

// UpdateItem
app.put("/updateItem/:idItems", function (req, res) {
  let idItems = req.params.idItems;
  let items = req.body;

  if (!idItems || !items || Object.keys(items).length === 0) {
    return res
      .status(400)
      .send({ error: true, message: "No update data provided" });
  }

  dbConn.query(
    "UPDATE items SET ? WHERE idItems = ?",
    [items, idItems],
    function (error, results, fields) {
      if (error) {
        console.error("Update error:", error);
        return res
          .status(500)
          .send({ error: true, message: "Database error", details: error });
      }
      return res.send({
        error: false,
        data: results,
        message: "Item updated successfully.",
      });
    }
  );
});

// Update UpdateItem  and Upload image
app.put(
  "/editupdateItem/:idItems",
  upload.single("image"),
  async function (req, res) {
    const {
      item_name,
      item_detail,
      price,
      location,
      item_status,
      category_name,
    } = req.body;
    const fileImage = req.files;
    const idItems = req.params.idItems;

    if (
      !idItems ||
      !item_name ||
      !item_detail ||
      !price ||
      !location ||
      !item_status
    ) {
      return res.status(400).send({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    let imgsrc =
      fileImage && fileImage.length > 0
        ? fileImage
            .map((file) => `${process.env.IMAGE_PATH}${file.filename}`)
            .join(",")
        : null;

    let categoryQuery = category_name
      ? `, idCategory = (SELECT idCategory FROM category WHERE category_name = ? LIMIT 1)`
      : ``; // ถ้า category_name ไม่มีค่า ให้ใช้ค่าเดิม

    const updateQuery = `
        UPDATE items 
        SET 
            item_name = ?, 
            item_detail = ?, 
            price = ?, 
            ${imgsrc ? "item_img = ?, " : ""}  -- ถ้ามีรูป ให้เพิ่มการอัปเดต
            location = ?, 
            item_status = ?
            ${categoryQuery}  
        WHERE idItems = ?
    `;

    // ถ้ามีรูปภาพ ให้ใส่ค่าลงไปด้วย
    const queryParams = imgsrc
      ? [
          item_name,
          item_detail,
          price,
          imgsrc,
          location,
          item_status,
          category_name,
          idItems,
        ]
      : [
          item_name,
          item_detail,
          price,
          location,
          item_status,
          category_name,
          idItems,
        ];

    dbConn.query(
      "SELECT * FROM items LEFT JOIN category ON category.idCategory = items.idCategory WHERE idItems = ?",
      [idItems],
      (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .send({ message: "Database error", error: err });
        }

        if (results.length === 0) {
          return res
            .status(404)
            .send({ error: true, message: "ไม่พบ idItems ที่ต้องการอัปเดต" });
        }

        // ตรวจสอบค่าที่มีอยู่ในฐานข้อมูล
        const existingItem = results[0];
        console.log("ค่าปัจจุบันในฐานข้อมูล:", existingItem);

        // ตรวจสอบว่ามีการเปลี่ยนแปลงจริงหรือไม่
        if (
          existingItem.item_name === item_name &&
          existingItem.item_detail === item_detail &&
          existingItem.price == price &&
          existingItem.location === location &&
          existingItem.item_status === item_status && 
          existingItem.category_name === category_name
        ) {
          return res
            .status(400)
            .send({ error: true, message: "ไม่มีข้อมูลเปลี่ยนแปลง" });
        }

        // ถ้ามีข้อมูลเปลี่ยนแปลงให้ทำ UPDATE
        dbConn.query(updateQuery, queryParams, (err, result) => {
          if (err) {
            console.error("Database update error:", err);
            return res
              .status(500)
              .send({ message: "Database error", error: err });
          }

          return res.send({ message: "Item updated successfully" });
        });
      }
    );
  }
);

//แอดมินลบโพสต์ปล่อยเช่าสินค้า
app.put("/delete_softItems/:idItems", function (req, res) {
  let idItems = req.params.idItems;
  if (!idItems) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide idItems" });
  }

  dbConn.query(
    "UPDATE items SET del_status = 'Y', deleteAt = NOW() WHERE idItems = ?",
    [idItems],
    function (error, results, fields) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "ลบโพสต์เรียบร้อยแล้ว",
      });
    }
  );
});

//แสดงโพสต์ทั้งหมดที่ถูกลบ
app.get("/deletedposts", function (req, res) {
  let query = `
        SELECT post.*, users.fname_lname, users.profile_picture
        FROM post
        LEFT JOIN users ON post.user_id = users.idUsers
        WHERE post.del_status = 'Y' AND post.approve_status = 'Y'
        ORDER BY post.idPost DESC
    `;

  dbConn.query(query, function (error, results, fields) {
    if (error) throw error;
    console.log(results);
    return res.send({
      error: false,
      data: results,
      message: "Deleted posts retrieved successfully.",
    });
  });
});

// กู้คืนโพสต์ทีี่ถูกลบ
app.put("/restorePost/:postId", function (req, res) {
  console.log(req.params.postId);
  dbConn.query(
    "UPDATE post SET del_status = 'N' WHERE idPost = ?",
    [req.params.postId],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "โพสต์ถูกกู้คืนเรียบร้อยแล้ว",
      });
    }
  );
});

// กู้คืนสินค้าทีี่ถูกลบ
app.put("/restoreProduct/:productId", function (req, res) {
  console.log(req.params.productId);
  dbConn.query(
    "UPDATE items SET del_status = 'N' WHERE idItems = ?",
    [req.params.productId],
    function (error, results) {
      if (error) throw error;
      return res.send({
        error: false,
        data: results,
        message: "สินค้าถูกกู้คืนเรียบร้อยแล้ว",
      });
    }
  );
});

//รายละเอียดเพิ่มเติม server
app.get("/detail/:id", function (req, res) {
  const idItems = req.params.id;

  if (!idItems) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide the item id" });
  }

  dbConn.query(
    `SELECT items.*, users.fname_lname, users.profile_picture, category.category_name FROM items
     LEFT JOIN users ON items.user_id = users.idUsers
     LEFT JOIN category ON items.idCategory = category.idCategory
      WHERE idItems = ?`,
    [idItems],
    function (error, results) {
      if (error) throw error;
      if (results[0]) {
        return res.send({
          idItems: results[0].idItems,
          item_name: results[0].item_name,
          item_detail: results[0].item_detail,
          price: results[0].price,
          item_img: results[0].item_img,
          location: results[0].location,
          item_status: results[0].item_status,
          fname_lname: results[0].fname_lname,
          user_id: results[0].user_id,
          profile_picture: results[0].profile_picture,
          createAt: results[0].createAt,
          category_name: results[0].category_name,
          
        });
      } else {
        return res
          .status(400)
          .send({ error: true, message: "item id not found!!" });
      }
    }
  );
});

// สำหรับค้นหาโพสต์ตาม post_detail
app.get("/searchPost", (req, res) => {
  const postSearch = req.query.post_detail;

  const query = `
        SELECT post.*, users.fname_lname, users.profile_picture
        FROM post
        LEFT JOIN users ON post.user_id = users.idUsers
        WHERE post.post_detail LIKE ? AND post.del_status = 'N' AND post.approve_status = 'Y'`;

  dbConn.query(query, ["%" + postSearch + "%"], (err, results) => {
    if (err) {
      console.error("Error in query: " + err.stack);
      res.status(500).send("Error in query");
      return;
    }

    res.json(results.length > 0 ? results : []);
  });
});

// สำหรับค้นหาสินค้าตาม item_name
app.get("/searchItems", (req, res) => {
  const itemSearch = req.query.item_name; // ใช้ req.query แทน req.params

  // การ query ฐานข้อมูลเพื่อค้นหาจาก post_detail
  const query =
    "SELECT * FROM items LEFT JOIN users ON items.user_id = users.idUsers WHERE item_name LIKE ? AND del_status = 'N' AND approve_status = 'Y'";
  dbConn.query(query, ["%" + itemSearch + "%"], (err, results) => {
    if (err) {
      console.error("Error in query: " + err.stack);
      res.status(500).send("Error in query");
      return;
    }

    // ส่งผลลัพธ์ที่ได้กลับไปยัง Client
    if (results.length > 0) {
      res.json(results); // หากพบผลลัพธ์ส่งกลับ
    } else {
      res.status(200).json([]); // ส่ง Array ว่างแทน 404
    }
  });
});

app.post("/create_chatroom", (req, res) => {
  const { name } = req.body;
  const sql = "INSERT INTO chatrooms (name) VALUES (?)";
  dbConn.query(sql, [name], (err, result) => {
    if (err) {
      return res.status(500).json({ status: "error", error: err });
    }
    res.json({ status: "success", chatRoomId: result.insertId });
  });
});

// API บันทึกข้อความลงฐานข้อมูล (แทน send_message.php)
app.post("/send_message", (req, res) => {
  const { chat_room_id, sender_id, message } = req.body;

  if (!sender_id || !message) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing parameters" });
  }

  // เช็คว่ามี chatRoomId อยู่แล้วหรือไม่
  const checkChatRoomSql = "SELECT id FROM chatrooms WHERE id = ?";
  dbConn.query(checkChatRoomSql, [chat_room_id], (err, result) => {
    if (err) {
      return res.status(500).json({ status: "error", error: err });
    }

    let finalChatRoomId = chat_room_id;

    // ถ้าไม่มี chatRoomId นี้อยู่ ให้สร้างใหม่
    if (result.length === 0) {
      const createChatRoomSql = "INSERT INTO chatrooms (id) VALUES (?)";
      dbConn.query(createChatRoomSql, [chat_room_id], (err, chatRoomResult) => {
        if (err) {
          return res.status(500).json({ status: "error", error: err });
        }
        finalChatRoomId = chatRoomResult.insertId; // ใช้ ID ที่สร้างใหม่
        insertMessage(finalChatRoomId);
      });
    } else {
      insertMessage(finalChatRoomId);
    }
  });

  // ฟังก์ชันเพิ่มข้อความลง database
  function insertMessage(chatRoomId) {
    const insertMessageSql =
      "INSERT INTO messages (chat_room_id, sender_id, message) VALUES (?, ?, ?)";
    dbConn.query(
      insertMessageSql,
      [chatRoomId, sender_id, message],
      (err, messageResult) => {
        if (err) {
          return res.status(500).json({ status: "error", error: err });
        }

        const messageId = messageResult.insertId;
        const selectMessageSql = "SELECT * FROM messages WHERE id = ?";
        dbConn.query(selectMessageSql, [messageId], (err, messageData) => {
          if (err) {
            return res.status(500).json({ status: "error", error: err });
          }
          res.json(messageData[0]);
        });
      }
    );
  }
});

// API ดึงข้อความจากฐานข้อมูล (แทน get_messages.php)
app.get("/messages/:chat_room_id", (req, res) => {
  const { chat_room_id } = req.params;
  const sql =
    "SELECT * FROM messages WHERE chat_room_id = ? ORDER BY timestamp ASC";
  dbConn.query(sql, [chat_room_id], (err, results) => {
    if (err) {
      return res.status(500).json({ status: "error", error: err });
    }
    res.json(results);
  });
});

//เป้ว



// เพิ่มไปยังรายการโปรด
app.post("/addFavorite", function (req, res) {
  const idItems = req.body.idItems;
  const idUsers = req.body.idUsers;

  // ตรวจสอบว่ามีข้อมูลครบถ้วนหรือไม่
  if (!idItems || !idUsers) {
    return res
      .status(400)
      .send({ error: true, message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  // ตรวจสอบว่ามีไลค์อยู่แล้วหรือไม่
  dbConn.query(
    "SELECT * FROM favorites WHERE idItems = ? AND idUsers = ?",
    [Number(idItems), Number(idUsers)],
    function (error, results) {
      if (error) {
        return res
          .status(500)
          .send({ error: true, message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์" });
      }

      // ถ้ามีไลค์แล้ว ให้แจ้งเตือน
      if (results.length > 0) {
        return res.send({
          error: true,
          message: "รายการนี้อยู่ในรายการโปรดของคุณแล้ว",
        });
      }

      // ถ้ายังไม่มี ให้เพิ่มไปยังรายการโปรด
      dbConn.query(
        "INSERT INTO favorites (idItems, idUsers) VALUES (?, ?)",
        [Number(idItems), Number(idUsers)],
        function (error) {
          if (error) {
            return res
              .status(500)
              .send({ error: true, message: "เกิดข้อผิดพลาดในการเพิ่มข้อมูล" });
          }
          return res.send({
            error: false,
            message: "เพิ่มรายการโปรดเรียบร้อยแล้ว",
          });
        }
      );
    }
  );
});

// ลบออกจากรายการโปรด
app.delete("/deleteFavorite/:idFavorites", function (req, res) {
  let idFavorites = Number(req.params.idFavorites);

  if (!idFavorites) {
    return res
      .status(400)
      .send({ error: true, message: "idFavorites ไม่ถูกต้อง" });
  }

  dbConn.query(
    "DELETE FROM favorites WHERE idFavorites = ?",
    idFavorites,
    function (error, results) {
      if (error) throw error;
      return res.send({ error: false, message: "ลบรายการโปรดเรียบร้อยแล้ว" });
    }
  );
});

// ลบออกจากรายการโปรดในหน้า detail
app.delete("/deleteFavorite/:productId/:userId", function (req, res) {
  let idItems = Number(req.params.productId);
  let idUsers = Number(req.params.userId);

  if (!idItems || !idUsers) {
    return res
      .status(400)
      .send({ error: true, message: "idFavorites ไม่ถูกต้อง" });
  }

  dbConn.query(
    "DELETE FROM favorites WHERE idItems = ? AND idUsers = ?",
    [idItems, idUsers],
    function (error, results) {
      if (error) throw error;
      return res.send({ error: false, message: "ลบรายการโปรดเรียบร้อยแล้ว" });
    }
  );
})

// SELECT items.*, category.category_name , users.fname_lname, users.email, users.profile_picture
// FROM items 
// LEFT JOIN category ON items.idCategory = category.idCategory

// WHERE items.del_status = 'N' AND items.approve_status = 'Y'
// ORDER BY items.idItems DESC

// แสดงรายการโปรด
app.get("/favorite/:idUsers", function (req, res) {
  let idUsers = Number(req.params.idUsers);

  if (!idUsers) {
    return res.status(400).send({ error: true, message: "id ไม่ถูกต้อง" });
  }

  dbConn.query(
    `
        SELECT items.*, users.fname_lname, users.email, users.profile_picture, category.category_name
        FROM favorites
        LEFT JOIN items ON favorites.idItems = items.idItems
        LEFT JOIN users ON items.user_id = users.idUsers
        LEFT JOIN category ON items.idCategory = category.idCategory
        WHERE favorites.idUsers = ? AND items.del_status = 'N' AND items.approve_status = 'Y'
    `,
    idUsers,
    function (error, results) {
      if (error) throw error;
      return res.send(results);
    }
  );
});

//เปลี่ยนสเตตัส
app.put("/updateItemStatus/:id", (req, res) => {
  const { id } = req.params;
  const { item_status } = req.body; // ควรได้รับจาก @Body ใน Retrofit

  if (!item_status) {
    return res.status(400).json({ message: "Missing item_status" });
  }

  const sql = "UPDATE items SET item_status = ? WHERE idItems = ?";
  dbConn.query(sql, [item_status, id], (err, result) => {
    if (err) {
      console.error("Error updating item status:", err);
      return res.status(500).json({ message: "Failed to update item status" });
    }
    return res.json({ message: "Item status updated successfully" });
  });
});

// แสดงสินค้าที่ปล่อยเช่าที่ถูกลบ
app.get("/deleteditems", function (req, res) {
  let query = `
        SELECT items.*, category.category_name , users.fname_lname, users.email
        FROM items 
        LEFT JOIN category ON items.idCategory = category.idCategory
        LEFT JOIN users ON items.user_id = users.idUsers
        WHERE items.del_status = 'Y'
        ORDER BY items.idItems DESC
    `;
  dbConn.query(query, function (error, results, fields) {
    if (error) throw error;
    return res.send({
      error: false,
      data: results,
      message: "Deleted items retrieved successfully.",
    });
  });
});

// == /chat ==

// ดึงแชททั้งหมดของผู้ใช้
app.get("/chats/:userId", (req, res) => {
  const userId = Number(req.params.userId);

  if (isNaN(userId)) {
    return res.status(400).json({ error: true, message: "Invalid user ID" });
  }

  const sql = `
        SELECT m.id, m.sender_id, m.receiver_id, m.message_text, m.createAt,
        sender.fname_lname AS sender_fname_lname, receiver.fname_lname AS receiver_fname_lname,
        sender.profile_picture AS sender_profile_picture, receiver.profile_picture AS receiver_profile_picture
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.idUsers
        LEFT JOIN users receiver ON m.receiver_id = receiver.idUsers
        WHERE sender_id = ? OR receiver_id = ? ORDER BY createAt DESC
    `;

  dbConn.query(sql, [userId, userId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ error: true, message: "Database error", details: err });
    }

    const uniqueChats = new Map();
    const chats = [];

    results.forEach((result) => {
      const otherUserId =
        result.sender_id === userId ? result.receiver_id : result.sender_id;
      const otherUserFnameLname =
        result.sender_id === userId
          ? result.receiver_fname_lname
          : result.sender_fname_lname;
      const otherProfileImage =
        result.sender_id === userId
          ? result.receiver_profile_picture
          : result.sender_profile_picture;
      if (!uniqueChats.has(otherUserId)) {
        uniqueChats.set(otherUserId, true);
        const newResult = {
          ...result,
          otherUserId,
          name: otherUserFnameLname,
          image: otherProfileImage,
        };
        delete newResult.sender_id;
        delete newResult.receiver_id;
        delete newResult.sender_fname_lname;
        delete newResult.receiver_fname_lname;
        delete newResult.sender_profile_picture;
        delete newResult.receiver_profile_picture;
        chats.push(newResult);
      }
      console.log(uniqueChats);
    });

    return res.json(chats);
  });
});

// ดึงข้อความระหว่างผู้ใช้
app.get("/chats/:userId/:otherUserId", (req, res) => {
  const userId = Number(req.params.userId);
  const otherUserId = Number(req.params.otherUserId);

  if (isNaN(userId) || isNaN(otherUserId)) {
    return res.status(400).json({ error: true, message: "Invalid user ID" });
  }

  const sql = `
        SELECT m.id, m.sender_id, m.receiver_id, m.message_text, m.createAt,
        sender.fname_lname AS sender_fname_lname, receiver.fname_lname AS receiver_fname_lname,
        sender.profile_picture AS sender_profile_picture, receiver.profile_picture AS receiver_profile_picture
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.idUsers
        LEFT JOIN users receiver ON m.receiver_id = receiver.idUsers
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY createAt ASC
    `;

  dbConn.query(
    sql,
    [userId, otherUserId, otherUserId, userId],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ error: true, message: "Database error", details: err });
      }

      return res.json(results);
    }
  );
});

// สร้างข้อความ
app.post("/chats", (req, res) => {
  const { sender_id, receiver_id, message_text } = req.body;

  console.log(req.body);

  if (!sender_id || !receiver_id || !message_text) {
    return res.status(400).json({ error: true, message: "Missing parameters" });
  }

  const sql =
    "INSERT INTO messages (sender_id, receiver_id, message_text, createAt) VALUES (?, ?, ?, NOW())";
  dbConn.query(sql, [sender_id, receiver_id, message_text], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ error: true, message: "Database error", details: err });
    }

    return res.json({
      error: false,
      message: "Message sent successfully",
      messageId: result.insertId,
    });
  });
});

// ดึงข้อมูลผู้ที่คุยด้วย
app.get("/chatheader/:userId", function (req, res) {
  let query = `
        SELECT users.idUsers, users.fname_lname, users.profile_picture
        FROM users
        WHERE users.idUsers = ?
    `;
  dbConn.query(query, [Number(req.params.userId)], function (error, results) {
    if (error) throw error;
    const result = results[0];
    if (!result) {
      return res.status(404).json({ error: true, message: "User not found" });
    }
    return res.send(result);
  });
});

// ดึงข้อมูลธนาคารและที่อยู่ในแชท
app.get("/chatsentinfo/:userId", function (req, res) {
  console.log("hi");
  let query = `
        SELECT users.address, users.bank, users.account_number, users.account_name
        FROM users
        WHERE users.idUsers = ?
    `;
  dbConn.query(query, [Number(req.params.userId)], function (error, results) {
    if (error) throw error;
    const result = results[0];
    if (!result) {
      return res.status(404).json({ error: true, message: "User not found" });
    }
    return res.send({
      address: `ที่อยู่\n${result.address}`,
      bank_account_info: `ข้อมูลบัญชีธนาคาร\n${result.bank}\nชื่อบัญชี: ${result.account_name}\nเลขบัญชี: ${result.account_number}`,
    });
  });
});

// == chat\ ==

app.post("/updateProfile", upload.any(), function (req, res) {
  const profile = req.body;
  const files = req.files;
  const profilePicture = files.find((file) => file.fieldname === "profile_picture");
  const idCard = files.find((file) => file.fieldname === "id_card_img");

  if (!profile) {
    return res
      .status(400)
      .send({ error: true, message: "Please provide correct data" });
  }

  const profile_picture = profilePicture
    ? process.env.IMAGE_PATH + profilePicture.filename
    : "no image";
  const id_card_img = idCard ? process.env.IMAGE_PATH + idCard.filename : "no image";

  if(profilePicture && idCard) {
    dbConn.query(
      `UPDATE users
      SET fname_lname = ?, email = ?, address = ?, bank = ?,
      account_number = ?, account_name = ?, phone = ?, profile_picture = ?, id_card_img = ?
      WHERE idUsers = ?`,
      [profile.fname_lname, profile.email, profile.address,
        profile.bank, profile.accountNumber, profile.accountName,
        profile.phone, profile_picture, id_card_img, profile.idUsers],
      function (error, results) {
        if (error) throw error;
        return res.send({ error: false, message: "Profile updated successfully" });
      }
    );
  } else if(profilePicture) {
    dbConn.query(
      `UPDATE users
      SET fname_lname = ?, email = ?, address = ?, bank = ?,
      account_number = ?, account_name = ?, phone = ?, profile_picture = ?
      WHERE idUsers = ?`,
      [profile.fname_lname, profile.email, profile.address,
        profile.bank, profile.accountNumber, profile.accountName,
        profile.phone, profile_picture, profile.idUsers],
      function (error, results) {
        if (error) throw error;
        return res.send({ error: false, message: "Profile updated successfully" });
      }
    );
  } else if(idCard) {
    dbConn.query(
      `UPDATE users
      SET fname_lname = ?, email = ?, address = ?, bank = ?,
      account_number = ?, account_name = ?, phone = ?, id_card_img = ?
      WHERE idUsers = ?`,
      [profile.fname_lname, profile.email, profile.address,
        profile.bank, profile.accountNumber, profile.accountName,
        profile.phone, id_card_img, profile.idUsers],
      function (error, results) {
        if (error) throw error;
        return res.send({ error: false, message: "Profile updated successfully" });
      }
    );
  } else {
    dbConn.query(
      `UPDATE users
       SET fname_lname = ?, email = ?, address = ?, bank = ?,
      account_number = ?, account_name = ?, phone = ?
       WHERE idUsers = ?`,
      [profile.fname_lname, profile.email, profile.address,
        profile.bank, profile.accountNumber, profile.accountName,
        profile.phone, profile.idUsers],
      function (error, results) {
        if (error) throw error;
        return res.send({ error: false, message: "Profile updated successfully" });
      }
    );
  }
});


// == /notification ==

// ดึงการแจ้งเตือนทั้งหมดของผู้ใช้
app.get("/notifications/:userId", (req, res) => {
  const userId = Number(req.params.userId);

  if (isNaN(userId)) {
      return res.status(400).json({ error: true, message: "Invalid user ID" });
  }

  const sql = "SELECT * FROM notifications WHERE idUsers = ? ORDER BY createAt DESC";
  dbConn.query(sql, [userId], (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: true, message: "Database error", details: err });
      }

      return res.json(results);
  });
})

// สร้างการแจ้งเตือน
app.post("/notifications", (req, res) => {
  const { idUsers, title, message } = req.body;

  if (!idUsers || !message) {
      return res.status(400).json({ error: true, message: "Missing parameters" });
  }

  const sql = "INSERT INTO notifications (title, message, idUsers, createAt) VALUES (?, ?, ?, NOW())";
  dbConn.query(sql, [title, message, idUsers], (err, result) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: true, message: "Database error", details: err });
      }

      return res.json({ message: "Notification created successfully", notificationId: result.insertId });
  });
})

// อัพเดตการอ่านของการแจ้งเตือน
app.put("/notifications/:notificationId", (req, res) => {
  const notificationId = Number(req.params.notificationId);

  if (isNaN(notificationId)) {
      return res.status(400).json({ error: true, message: "Invalid notification ID" });
  }

  const sql = "UPDATE notifications SET is_read = 1 WHERE idNotifications = ?";
  dbConn.query(sql, [notificationId], (err, result) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: true, message: "Database error", details: err });
      }

      return res.json({ message: "Notification updated successfully" });
  });
})

// ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
app.get("/notifications/:userId/unread-count", (req, res) => {
  const userId = Number(req.params.userId);

  if (isNaN(userId)) {
      return res.status(400).json({ error: true, message: "Invalid user ID" });
  }

  const sql = "SELECT COUNT(*) AS count FROM notifications WHERE idUsers = ? AND is_read = 0";
  dbConn.query(sql, [userId], (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: true, message: "Database error", details: err });
      }

      return res.json(results[0]);
  });
})

// == notification\ ==

// ตรวจสอบสถานะการเป็นรายการโปรด
app.get("/checkFavorite/:idItems/:idUsers", function (req, res) {
  const idItems = req.params.idItems;
  const idUsers = req.params.idUsers;

  // ตรวจสอบว่ามีข้อมูลครบถ้วนหรือไม่
  if (!idItems || !idUsers) {
    return res.status(400).json({ 
      error: true, 
      message: "Invalid item ID or user ID provided" 
    });
  }

  // เช็คว่ามีข้อมูลในฐานข้อมูลหรือไม่
  dbConn.query(
    "SELECT idFavorites FROM favorites WHERE idItems = ? AND idUsers = ?",
    [idItems, idUsers],
    function (error, results) {
      if (error) {
        console.error("Database error:", error);
        return res.status(500).json({
          error: true,
          message: "Error checking favorite status",
          details: error
        });
      }

      // ถ้าเจอข้อมูลให้ส่งค่า true กลับไป
      return res.json(results.length > 0);
    }
  );
});

app.listen(3000, "0.0.0.0", function () {
  console.log("Node app is running on port 3000");
});

module.exports = app;
