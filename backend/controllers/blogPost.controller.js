const logger = require('../utils/logger');
const BlogPost = require('../models/BlogPost');
const {createError} = require("../middleware/errorHandler");

// Créer un nouvel article
exports.createPost = async (req, res, next) => {
  try {
    const post = new BlogPost({
      ...req.body,
      image :`${req.protocol}://${req.get('host')}/uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${req.file.filename}`,
      tags : req.body.tags.split(',')
    });
    await post.save();
    return res.status(201).json(post);
  } catch (err) {
    logger.info(err.message)
    return next(createError.badRequest(err.message));
  }
};

exports.getPublishedPosts = async (req, res, next) => {
  try {
    const posts = await BlogPost.find({
      status : 'published'
    })
    if(posts.length >= 1){
      return res.status(200).json(posts);
    }
    return next(createError.notFound("Aucun article trouvé."));
  } catch (error) {
    return next(createError.badRequest(error.message));
  }
}

exports.getArchivedPosts = async (req, res, next) => {
  try {
    const posts = await BlogPost.find({
      status : 'archived'
    })
    if(posts.length >= 1){
      return res.status(200).json(posts);
    }
    return next(createError.notFound("Aucun article trouvé."));
  } catch (error) {
    return next(createError.badRequest(error.message));
  }
}

exports.getPublishedPostsByUserId = async (req, res, next) => {
  try {
    const posts = await BlogPost.find({
      status : 'published',
      authorId : req.params.id
    })
    if(posts.length >= 1){
      return res.status(200).json(posts);
    }
    return next(createError.notFound("Aucun article trouvé."));
  } catch (error) {
    return next(createError.badRequest(error.message));
  }
}

exports.getDraftPostsByUserId = async (req, res, next) => {
  try {
    const posts = await BlogPost.find({
      status : 'draft',
      authorId : req.params.id
    })
    if(posts.length >= 1){
      return res.status(200).json(posts);
    }
    return next(createError.notFound("Aucun article trouvé."));
  } catch (error) {
    return next(createError.badRequest(error.message));
  }
}

exports.getArchivedPostsByUserId = async (req, res, next) => {
  try {
    const posts = await BlogPost.find({
      status : 'archived',
      authorId : req.params.id
    })
    if(posts.length >= 1){
      return res.status(200).json(posts);
    }
    return next(createError.notFound("Aucun article trouvé."));
  } catch (error) {
    return next(createError.badRequest(error.message));
  }
}

exports.archivePost = async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({
      _id : req.params.id
    })
    if (!post) {
      return next(createError.notFound("Article non trouvé"));
    }
    post.status = 'archived'
    await post.save()
    return res.status(203).json(post)
  } catch (error) {
    return next(createError.badRequest(error.message));
  }
}

exports.publishPost = async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({
      _id : req.params.id
    })
    if (!post) {
      return next(createError.notFound("Article non trouvé"));
    }
    post.status = 'published'
    post.publishDate = Date.now()
    await post.save()
    return res.status(203).json(post)
  } catch (error) {
    logger.info(error.message)
    return next(createError.badRequest(error.message));
  }
}

// Obtenir tous les articles
exports.getAllPosts = async (req, res, next) => {
  try {
    const posts = await BlogPost.find();
    if(posts.length >= 1){
      return res.status(200).json(posts);
    }
    return next(createError.notFound("Aucun article trouvé."));
  } catch (err) {
    logger.info(err.message)
    next(createError.internal(err.message));
  }
};

// Obtenir un article par ID
exports.getPostById = async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({_id : req.params.id});
    if (!post) return next(createError.notFound("Article non trouvé"));
    post.visited += 1;
    await post.save();
    return res.status(200).json(post);
  } catch (err) {
    next(createError.internal(err.message));
  }
};

// Mettre à jour un article
exports.updatePost = async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({_id : req.params.id});
    if (!post) return next(createError.notFound("Article non trouvé"));
    if(req.body.title) post.title = req.body.title
    if(req.body.excerpt) post.excerpt = req.body.excerpt
    if(req.body.content) post.content = req.body.content
    if(req.body.file) post.image = `${req.protocol}://${req.get('host')}/uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${req.file.filename}`
    await post.save()
    return res.status(200).json(post);
  } catch (err) {
    next(createError.badRequest(err.message));
  }
};

// Supprimer un article
exports.deletePost = async (req, res, next) => {
  try {
    const post = await BlogPost.findOneAndDelete({_id : req.params.id});
    if (!post) return next(createError.notFound("Article non trouvé"));
    return res.status(200).json({ message: 'Article supprimé avec succès' });
  } catch (err) {
    next(createError.internal(err.message));
  }
};

exports.deleteAllPosts = async (req, res, next) => {
  try {
    await BlogPost.deleteMany();
    return res.status(200).json({ message: 'Articles supprimés avec succès' })
  } catch (error) {
    return next(createError.internal(error.message));
  }
}

exports.addComment= async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({_id : req.params.id});
    if (!post) return next(createError.notFound("Article non trouvé"));
    
    post.comments.push(req.body);
    await post.save();
    
    return res.status(200).json(post);
  } catch (err) {
    next(createError.badRequest(err.message));
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({_id : req.params.id});
    if (!post) return next(createError.notFound("Article non trouvé"));
    
    post.comments = post.comments.filter(comment => comment._id.toString() !== req.params.commentId);
    await post.save();
    
    return res.status(200).json(post);
  } catch (err) {
    next(createError.badRequest(err.message));
  }
};

exports.deleteAll = async (req, res, next) => {
    try {
      await BlogPost.deleteMany({})
      return res.status(200).json({ message: 'Tous les articles ont été supprimés avec succès' });
    } catch (error) {
        return next(createError.internal("Erreur lors de la suppression"));
    }
}