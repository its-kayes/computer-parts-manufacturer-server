const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
let app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yffmf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        let partsCollection = client.db("partsdb").collection("parts");
        let reviewsCollection = client.db("partsdb").collection("reviews");
        let ordersCollection = client.db("partsdb").collection("orders")

        // Load Parts
        app.get('/parts', async(req, res)=> {
            let query = {}
            let data = await partsCollection.find(query).toArray();
            res.send(data);
        });

        // Reviews Data Load
        app.get('/reviews', async(req, res) => {
            let query = {}
            let data = await reviewsCollection.find(query).toArray();
            res.send(data);
        });

        // Load Single Parts
        app.get('/parts/:id', async(req, res)=> {
            let id = req.params.id;
            let query = {_id: ObjectId(id)};
            let data = await partsCollection.findOne(query);
            res.send(data);
        })

        // Order 
        app.post('/orders', async(req, res)=> {
            let data = req.body;
            let result = await ordersCollection.insertOne(data);
            res.send(result);
        })

    }

    finally{
        
    }
}










run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Parts Manufacturer Is On Fire ');
});

app.listen(port, () => {
    console.log('Run Server to port', port);
})