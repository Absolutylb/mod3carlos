const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(bodyParser.json());

// Conexão ao MongoDB
mongoose.connect('mongodb://localhost:27017/blog', { useNewUrlParser: true, useUnifiedTopology: true });

// Middleware para autenticação
const authenticateJWT = (req, res, next) => {
const token = req.headers['authorization'];
if (token) {
jwt.verify(token, 'secretkey', (err, user) => {
if (err) return res.sendStatus(403);
req.user = user;
next();
});
} else {
res.sendStatus(401);
}
};

// Rotas de Usuário
app.post('/register', async (req, res) => {
const { username, password, role } = req.body;
const hashedPassword = await bcrypt.hash(password, 10);
const user = new User({ username, password: hashedPassword, role });
await user.save();
res.status(201).send('User registered');
});

// Login e geração de token
app.post('/login', async (req, res) => {
const { username, password } = req.body;
const user = await User.findOne({ username });
if (user && (await bcrypt.compare(password, user.password))) {
const token = jwt.sign({ id: user._id, role: user.role }, 'secretkey');
res.json({ token });
} else {
res.send('Username or password incorrect');
}
});

// Rotas de Postagens
app.post('/postagens', authenticateJWT, async (req, res) => {
if (req.user.role !== 'autor' && req.user.role !== 'administrador') {
return res.sendStatus(403);
}
const post = new Post({ ...req.body, author: req.user.id });
await post.save();
res.status(201).send(post);
});

app.get('/postagens', async (req, res) => {
const posts = await Post.find().populate('author');
res.json(posts);
});

// Comentários
app.post('/postagens/:postId/comentarios', authenticateJWT, async (req, res) => {
const comment = new Comment({ ...req.body, userId: req.user.id, postId: req.params.postId });
await comment.save();
await Post.findByIdAndUpdate(req.params.postId, { $push: { comments: comment._id } });
res.status(201).send(comment);
});

app.get('/postagens/:postId/comentarios', async (req, res) => {
const comments = await Comment.find({ postId: req.params.postId }).populate('userId');
res.json(comments);
});

// Curtidas
app.post('/postagens/:postId/curtidas', authenticateJWT, async (req, res) => {
const post = await Post.findById(req.params.postId);
if (post.likes.includes(req.user.id)) {
post.likes.pull(req.user.id);
} else {
post.likes.push(req.user.id);
}
await post.save();
res.json(post);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
