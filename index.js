const express = require("express");
const cors = require("cors"); //corss origin error
const { MongoClient, ServerApiVersion } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config(); // all keys(username and pass) inside .env will be configured

const app = express();
const port = process.env.PORT || 8000;
const userdb = process.env.USERDB;
const passdb = process.env.PASSDB;

app.use(cors()); //use cors

app.use(express.json());

const uri = `mongodb+srv://${userdb}:${passdb}@cluster0.xt26dbm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(
  uri,

  {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  }
);

// const photoStorage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/photos"); // Specify the directory for photo uploads
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + file.originalname); // Generate unique filenames
//   },
// });

// const dataStorage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/data"); // Specify the directory for data file uploads
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + file.originalname); // Generate unique filenames
//   },
// });

// const photoUpload = multer({ storage: photoStorage }).single("photo");
// const dataUpload = multer({ storage: dataStorage }).single("data");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads"); // Define the destination directory for file uploads
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Generate a unique filename for each uploaded file
  },
});

const upload = multer({ storage: storage });

async function connectToDB() {
  try {
    await client.connect();
    console.log("Connection successfully done!!! +++");
  } catch (error) {
    console.log("ERROR :", error);
  }
}
async function disconnectToDB() {
  try {
    await client.close();
    console.log("Disconnected from database ");
  } catch (error) {
    console.log("ERROR :", error);
  }
}
async function run() {
  try {
    await connectToDB();
    const userCollection = client.db("InnoVenture").collection("user");
    const startupCollection = client.db("InnoVenture").collection("StartupDB");
    app.post("/postUser", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch("/updateUser/:email", async (req, res) => {
      const filters = req.params;
      const newAttribute = req.body;
      const options = { upsert: true };
      const updatedAtt = { $set: newAttribute };
      const result = await userCollection.updateOne(
        filters,
        updatedAtt,
        options
      );
      res.send(result);
    });
    app.post(
      "/postStartup",
      upload.fields([{ name: "data" }]),
      async (req, res) => {
        try {
          const { name, email, description, usp, photo } = req.body;

          // Get the filenames of the uploaded photos
          // const photoFilename = req.files["photo"]
          //   ? req.files["photo"][0].filename
          //   : null;
          const dataFilename = req.files["data"]
            ? req.files["data"][0].filename
            : null;

          // Create an object representing the startup details
          const startupDetails = {
            name,
            email,
            description,
            usp,
            photo,
            data: dataFilename,
          };

          // Insert the startup details into the database
          const result = await startupCollection.insertOne(startupDetails);

          // Send a success response with the inserted document
          res.status(201).json({ success: true });
        } catch (error) {
          console.error("Error inserting startup details:", error);
          res
            .status(500)
            .json({ success: false, error: "Internal server error" });
        }
      }
    );
    app.get("/getStartDet/:email", async (req, res) => {
      try {
        const startupDet = await startupCollection.findOne({
          email: req.params.email,
        });

        if (!startupDet) {
          return res.status(404).json({ message: "Startup details not found" });
        }
        let dataPath, dataContent;
        // Construct file paths for photo and data
        //const photoPath = path.join(__dirname, "uploads", startupDet.photo);
        console.log("STARTTTUPP1::", startupDet.data);
        if (startupDet.data) {
          dataPath = path.join(__dirname, "uploads", startupDet.data);

          // Read file contents
          //const photoContent = fs.readFileSync(photoPath, "base64");
          dataContent = fs.readFileSync(dataPath, "utf8");
        }

        // Include file contents in the response JSON
        const response = {
          name: startupDet.name,
          email: startupDet.email,
          description: startupDet.description,
          usp: startupDet.usp,
          photo: startupDet.photo,
          data: {
            filename: startupDet.data,
            content: dataContent,
          },
        };

        res.json(response);
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    });
    app.patch(
      "/updateStartup/:email",
      upload.fields([{ name: "data" }]),
      async (req, res) => {
        try {
          const { name, email, description, usp, photo } = req.body;

          // Get the filename of the uploaded data file
          const dataFilename = req.files["data"]
            ? req.files["data"][0].filename
            : null;

          // Create an object representing the updated startup details
          const updatedStartupDetails = {
            name,
            email,
            description,
            usp,
            photo,
            data: dataFilename,
          };
          console.log("EMAILLLL:", email);
          // Find the startup document by email and update it with the new details
          const result = await startupCollection.updateOne(
            { email: email }, // Filter by email
            { $set: updatedStartupDetails }, // Update with new details
            { upsert: true } // Create new document if not found
          );

          res.status(200).json({ success: true });
        } catch (error) {
          console.error("Error updating startup details:", error);
          res
            .status(500)
            .json({ success: false, error: "Internal server error" });
        }
      }
    );
    app.get("/getAllStartups", async (req, res) => {
      try {
        const startups = await startupCollection.find().toArray();
        res.status(200).json({ success: true, data: startups });
      } catch (error) {
        res.status(404).json({ success: false });
      }
    });
    app.get("/", async (req, res) => {
      res.send("HELLO SERVER HERE!!");
    });
    app.listen(port, () => {
      console.log(`SERVER LISTEN ON PORT ${port}`);
    });
    app.get("/isStartupPresent/:email", async (req, res) => {
      const findemail = req.params.email;
      const listStr = await startupCollection.find().toArray();
      //console.log("Startupss", listStr);
      const start = await startupCollection.findOne({ email: findemail });
      //console.log(start, findemail);
      if (start) {
        res.status(200).json({ sucess: true, message: "Found" });
      } else {
        res.status(201).json({ sucess: false, message: "Not Found" });
      }
    });
  } catch (error) {
    console.log("ERROR :", error);
  }
}

run();
module.exports = app;
