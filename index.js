const express = require("express");
const cors = require("cors"); //corss origin error
const { MongoClient, ServerApiVersion,ObjectId  } = require("mongodb");
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
    const productCollection = client.db("InnoVenture").collection("MarketDB");

    app.post("/postUser", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch("/updateUser/:id", async (req, res) => {
      const id = req.params.id;
      const newAttribute = req.body;
      const options = { upsert: true };
      const updatedAtt = { $set: newAttribute };
      const result = await userCollection.updateOne(
        {firebase_Id:id},
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
          const { name, email, description, usp, photo,valuation,
            availableEquity } = req.body;

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
            valuation,
            availableEquity,
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
    app.get("/getStartDet/:id", async (req, res) => {
      try {
        const startupDet = await startupCollection.findOne({
          firebase_Id: req.params.id,
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
          valuation: startupDet.valuation,
          availableEquity: startupDet.availableEquity,
          data: {
            filename: startupDet.data,
            content: dataContent,
          },
          offer_amount:startupDet.offer_amount ,
          offer_equity:startupDet.offer_equity
        };

        res.json(response);
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }
    });

    app.patch("/addEquity/:firebase_Id", async (req, res) => {
      const firebase_Id = req.params.firebase_Id;
      const newAttribute = req.body;
      const options = { upsert: true };
      const updatedAtt = { $set: newAttribute };
      const result = await startupCollection.updateOne(
        { firebase_Id: firebase_Id },
        updatedAtt,
        options
      );
      res.send(result);
    });
    app.patch("/buyEquity/:firebase_Id", async (req, res) => {
      const firebase_Id = req.params.firebase_Id;
      const { amount, reqEquity } = req.body;
      
      const start = await startupCollection.findOne({
        firebase_Id: firebase_Id,
      });
      const remAmt = start.offer_amount - amount;
      const remEquity = start.offer_equity - reqEquity;
      const options = { upsert: true };
      const updatedAtt = {
        $set: { offer_amount: remAmt, offer_equity: remEquity },
      };
      const result = await startupCollection.updateOne(
        { firebase_Id: firebase_Id },
        updatedAtt,
        options
      );
      res.send(result);
    });

    app.patch(
      "/updateStartup/:id",
      upload.fields([{ name: "data" }]),
      async (req, res) => {
        try {
          const { name, email, description, usp, photo, valuation,
            availableEquity} = req.body;
          const currID=req.params.id
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
            valuation,
            availableEquity,
            data: dataFilename,
          };
          console.log("EMAILLLL:", email);
          // Find the startup document by email and update it with the new details
          const result = await startupCollection.updateOne(
            { firebase_Id:currID  }, // Filter by id
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

   


    app.get("/checkLoginType/:email", async (req, res) => {
      const email=req.params.email
      console.log("EMAIL AT LOGIN :",email)
      const startup=await userCollection.findOne({email : email})
      console.log("STRATUP :",startup.logintype)
      if(startup.logintype==="")
        return res.status(200).json({success:true})
      else  
        return res.status(400).json({fail:false})
      res.send("HELLO SERVER HERE!!");
    });
    app.listen(port, () => {
      console.log(`SERVER LISTEN ON PORT ${port}`);
    });
    app.get("/isStartupPresent/:id", async (req, res) => {
      const findID = req.params.id;
      const listStr = await startupCollection.find().toArray();
      const start = await startupCollection.findOne({ firebase_Id: findID });
      if (start) {
        res.status(200).json({ sucess: true, message: "Found" });
      } else {
        res.status(400).json({ sucess: false, message: "Not Found" });
      }
    });


    // app.get("/getAllEquityDet", async (req, res) => {
    //   try {
    //     const startups = await startupCollection.find().toArray();
    //     const equityDet = res
    //       .status(200)
    //       .json({ success: true, data: startups });
    //   } catch (error) {
    //     res.status(404).json({ success: false });
    //   }
    // });





    app.post("/postProducts", async (req, res) => {
      try {
        const addAttr = req.body;
        const resp = await productCollection.insertOne(addAttr);
        res.status(200).json({
          success: true,
          data: resp,
        });
      } catch (error) {
        res.status(400).json({ success: false });
      }
    });

    app.get("/getProducts/:firebase_Id", async (req, res) => {
      try {
        const firebase_Id = req.params.firebase_Id;
        const prod = await productCollection
          .find({ firebase_Id: firebase_Id })
          .toArray();
        res.status(200).json({ products: prod });
      } catch (error) {
        res.status(400).json({ success: false });
      }
    });
    app.patch("/updateProd/:productId", async (req, res) => {
      try {
        const prodId = req.params.productId;
        const ObjectId1 = new ObjectId(prodId);
        const { name, description } = req.body;
        console.log("PRODDUCTIDD:", typeof prodId, name, description);
        const resp = await productCollection.updateOne(
          { _id: ObjectId1 },
          { $set: { name: name, description: description } }
        );
        console.log("RESPP:", resp);
        if (resp.modifiedCount === 1) {
          res.status(200).json({ success: true, message: "ProductModified!!" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Product nhi mila!" });
        }
      } catch (error) {
        console.log("ERRORRR:", error);
        res.status(500).json({ success: false, message: "ERROR hai bhaiya" });
      }
    });






    app.get("/", async (req, res) => {
      res.send("HELLO SERVER HERE!!");
    });



  } catch (error) {
    console.log("ERROR :", error);
  }
}

run();
module.exports = app;
