const { MongoClient, ServerApiVersion, ObjectId, Transaction } = require('mongodb');
const express = require('express');
const cors = require('cors');
let jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
let app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yffmf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    // console.log(process.env.SECRET_KEY);
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    // console.log(token);
    jwt.verify(token, 'kayessecret', function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}



async function run() {
    try {
        await client.connect();
        let partsCollection = client.db("partsdb").collection("parts");
        let reviewsCollection = client.db("partsdb").collection("reviews");
        let ordersCollection = client.db("partsdb").collection("orders");
        let usersInfoCollection = client.db("partsdb").collection("users");
        let usersCollection = client.db("partsdb").collection("allusers");
        let paymentCollection = client.db("partsdb").collection("payments");

        // Load Parts
        app.get('/parts', async (req, res) => {
            let query = {}
            let data = await partsCollection.find(query).toArray();
            res.send(data);
        });

        // Reviews Data Load
        app.get('/reviews', async (req, res) => {
            let query = {}
            let data = await reviewsCollection.find(query).toArray();
            res.send(data);
        });

        // Load Single Parts
        app.get('/parts/:id', async (req, res) => {
            let id = req.params.id;
            let query = { _id: ObjectId(id) };
            let data = await partsCollection.findOne(query);
            res.send(data);
        });

        // Order 
        app.post('/orders', async (req, res) => {
            let data = req.body;
            let result = await ordersCollection.insertOne(data);
            res.send(result);
        });

        // Order Load
        app.get('/orders/:email', verifyJWT, async (req, res) => {
            let email = req.params.email;
            console.log(email);
            const decodedEmail = req.decoded.email;
            console.log(decodedEmail);
            if (email === decodedEmail) {
                let data = await ordersCollection.find({ email: email }).toArray();
                return res.send(data);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        });

        // Post Reviews
        app.post('/reviews', async (req, res) => {
            let data = req.body;
            let result = await reviewsCollection.insertOne(data);
            res.json(result);
        })

        // User Update
        app.put('/users/:email', async (req, res) => {
            let email = req.params.email;
            let data = req.body;
            let filter = { email: email };
            let option = { upsert: true };
            let updateInfo = {
                $set: data,
            }
            let result = await usersInfoCollection.updateOne(filter, updateInfo, option);
            res.send(result);
        });

        // Get User Info 
        app.get('/users/:email', async (req, res) => {
            let email = req.params.email;
            let query = { email: email };
            let data = await usersInfoCollection.findOne(query);
            res.send(data)
        });

        // Store Users for Admin role 
        app.put('/allusers/:email', async (req, res) => {
            let email = req.params.email;
            let user = req.body;
            let filter = { email: email };
            let option = { upsert: true };
            let updateUser = {
                $set: user,
            };
            let result = await usersCollection.updateOne(filter, updateUser, option);
            let accessToken = jwt.sign({ email: email }, 'kayessecret')
            res.send({ result, token: accessToken });
        });

        // Get User data
        app.get('/allusers', async (req, res) => {
            let result = await usersCollection.find({}).toArray();
            res.send(result);
        })

        // Get User data for admin
        app.get('/user/:email', async (req, res) => {
            let email = req.params.email;
            let user = await usersCollection.findOne({ email: email });
            let isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        // Make Admin  
        app.put('/allusers/admin/:email', verifyJWT, async (req, res) => {
            let email = req.params.email;
            let requester = req.decoded.email;
            console.log(requester);
            let check = await usersCollection.findOne({ email: requester });
            if (check.role === 'admin') {
                let filter = { email: email };
                let updateUser = {
                    $set: { role: 'admin' },
                };
                let result = await usersCollection.updateOne(filter, updateUser);
                return res.send(result);
            }
            else {
                res.status(403).send({ massage: 'Forbidden' });
            }
        });

        // Add Product for Admin
        app.post('/products', async (req, res) => {
            let data = req.body;
            let result = await partsCollection.insertOne(data);
            res.send(result);
        });

        // Delete Parts
        app.delete('/part/:id', async (req, res) => {
            let id = req.params.id;
            let query = { _id: ObjectId(id) };
            let data = await partsCollection.deleteOne(query)
            res.send(data);
        });

        // Manage orders
        app.get('/manageorders', async (req, res) => {
            let query = {}
            let data = await ordersCollection.find(query).toArray();
            res.send(data);
        });

        // Get Order by ID
        app.get('/payment/:id', async (req, res) => {
            let id = req.params.id;
            let query = { _id: ObjectId(id) };
            let data = await ordersCollection.findOne(query);
            res.send(data);
        });

        // Payment Post
        app.post('/create-payment-intent', async (req, res) => {
            const order = req.body;
            console.log(order);
            const price = order.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        // Store Payment Data
        app.patch('/order/:id', async(req, res)=> {
            let id = req.params.id;
            let payment = req.body;
            let query = {_id: ObjectId(id)};
            let updateData = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            let data = await paymentCollection.insertOne(payment);
            let orderUpdate = await ordersCollection.updateOne(query, updateData);
            res.send(updateData)
        });

        // Delete order
        app.delete('/order/:id', async (req, res) => {
            let id = req.params.id;
            let query = { _id: ObjectId(id) };
            let data = await ordersCollection.deleteOne(query)
            res.send(data);
        });

    }

    finally {

    }
}


run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Parts Manufacturer Is On Fire ');
});

app.listen(port, () => {
    console.log('Run Server to port', port);
})