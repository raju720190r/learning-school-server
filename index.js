const express =require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;

// Midddleware 
app.use (cors());
app.use(express.json());


app.get('/',(req,res)=>{
    res.send('Server Is Running')
})

app.listen(port,()=>{
    console.log(`Learning School is Running On port ${port}`);
})
