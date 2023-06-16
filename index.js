const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// Mongodb Connection 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.D_USER}:${process.env.D_PASS}@cluster0.9k9az0h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // MongoDB All User Collection
    const classCollection = client.db("learningSchool").collection("classes");
    const userCollection = client.db("learningSchool").collection("users");
    const selectedClassesCollection = client
      .db("learningSchool")
      .collection("selected");
    const pendingClassCollection = client.db("learningSchool").collection("pending");
    const paymentCollection = client.db("learningSchool").collection("payments");




    //create jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.get("/popularClasses", async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection
        .find(query)
        .sort({ studentNumber: -1 })
        .toArray();
      // const mostPopularClass = result.slice(0,6)
      res.send(result);
    });

    // store pendingClass in database
    app.post("/pendingClass", verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    });

    //get pending class admin
    app.get("/pendingClass", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // update pending class status
    //todo
    app.patch("/changePendingClass", async (req, res) => {
      const id = req.body.id;
      const work = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: work,
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // collect instructorClass
    app.get("/instructorClasses", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // create feedback for instructor class
    app.patch("/instructorFeedback", async (req, res) => {
      const id = req.body.id;
      const work = req.body.text;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: work,
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //check isInstructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ isInstructor: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "instructor" };
      res.send(result);
    });

    //check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    //user create
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin", async (req, res) => {
      const id = req.body.id;
      const work = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: work,
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //class selected
    app.get("/classSelects", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await selectedClassesCollection.find(query).toArray();
      res.send(result);
    });

    //add class in selected database
    app.post("/classSelects", async (req, res) => {
      const item = req.body;
      const result = await selectedClassesCollection.insertOne(item);
      res.send(result);
    });

    // update student number
    app.patch('/updateStudent', async (req, res) => {
      const id = req.body.id
      const query = { _id: new ObjectId(id) }
      const find = await classCollection.findOne(query)
      const studentNumber = find.studentNumber + 1
      const availableSeats = find.availableSeats - 1
      const updateDoc = {
        $set: {
          studentNumber: studentNumber,
          availableSeats: availableSeats
        },
      };
      console.log('update', updateDoc);

      const result = await classCollection.updateOne(find, updateDoc);
      res.send(result)

    })

    app.delete("/classSelects/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    });

    //create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    ///pending
    app.get("/payed-class/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await paymentCollection.find(query).sort({ date: -1 }).toArray()
      res.send(result);
    });

    //payment related api
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const id = req.body.id
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);

      res.send({ insertResult, result });
    });

    ///admin
    app.get("/admin-state", verifyJWT, verifyAdmin, async (req, res) => {
      const user = await userCollection.estimatedDocumentCount();
      const product = await classCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);
      res.send({
        user,
        product,
        orders,
        revenue,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Server Is Running')
})

app.listen(port, () => {
  console.log(`Learning School is Running On port ${port}`);
})
