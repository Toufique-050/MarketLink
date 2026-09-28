const Category=require('../models/Category');
async function listCategories(req,res){const categories=await Category.find({isActive:true}).sort({name:1});res.json({success:true,categories});}
module.exports={listCategories};
