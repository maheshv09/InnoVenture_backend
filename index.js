const express=require('express')
const cors=require('cors') //corss origin error
const {MongoClient,ServerApiVersion }=require('mongodb')
require('dotenv').config()    // all keys(username and pass) inside .env will be configured   



const app=express();
const port =process.env.PORT||8000;
const userdb=process.env.USERDB;
const passdb =process.env.PASSDB;


app.use(cors()); //use cors

app.use(express.json());



const uri=`mongodb+srv://${userdb}:${passdb}@cluster0.xt26dbm.mongodb.net/?retryWrites=true&w=majority`
const client=new MongoClient(uri,
    
    {serverApi:{
        version:ServerApiVersion.v1,
        strict:true,
        deprecationErrors:true
    }});




async function connectToDB(){
    try{
        await client.connect();
        console.log("Connection successfully done!!! +++");
    }
    catch(error){
        console.log("ERROR :",error);
    }
}
async function disconnectToDB(){
    try{
        await client.close();
        console.log("Disconnected from database ");
    }
    catch(error){
        console.log("ERROR :",error);
    }
}
async function run(){
    try{
        await connectToDB();
        const userCollection=client.db('InnoVenture').collection('user');
        app.post('/postUser',async(req,res)=>{
            const user=req.body;
            const result=await userCollection.insertOne(user);
            res.send(result);
        });
        app.patch('/updateUser/:email',async(req,res)=>{
            const filters=req.params;
            const newAttribute=req.body;
            const options={upsert:true}
            const updatedAtt={$set:newAttribute }
            const result=await userCollection.updateOne(filters,updatedAtt,options);
            res.send(result);

        }
        )

        app.get('/',async(req,res)=>{
            res.send('HELLO SERVER HERE!!')

        }) 
        app.listen(port,()=>{

            console.log(`SERVER LISTEN ON PORT ${port}`);
        })   

    }
    catch(error){
        console.log("ERROR :",error);

    }
}

run();
module.exports=app;


