const express = require("express");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const port = 4000;

app.use(express.json());

const users = [];

// Middleware untuk autentikasi token
const authenticateToken = (req, res, next) => {
  const token =
    req.headers["authorization"] && req.headers["authorization"].split(" ")[1];
  if (!token)
    return res.status(401).json({ status: "error", message: "Unauthorized" });

  jwt.verify(token, "secret", (err, user) => {
    if (err)
      return res.status(403).json({ status: "error", message: "Forbidden" });

    req.user = user;
    next();
  });
};

const threads = [];

const comments = [];

const votes = [];

app.get('/', (req, res) => {
  res.send('Hey this is my API running ?')
})

// Register User with Admin Check
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if (users.some((user) => user.email === email)) {
    return res
      .status(400)
      .json({ status: "error", message: "Email already registered" });
  }

  // Check if the provided email is the admin's email
  if (email.toLowerCase() === "admin@gmail.com") {
    return res.status(400).json({
      status: "error",
      message: "Admin email cannot be used for registration",
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const newUser = {
    id: `user-${uuidv4()}`,
    name,
    email,
    password: hashedPassword,
    avatar: `https://generated-image-url.jpg`,
  };

  users.push(newUser);

  res.status(201).json({
    status: "success",
    message: "User created",
    data: { user: newUser },
  });
});

// Create Admin User
app.post("/create-admin", (req, res) => {
  const { name, email, password } = req.body;

  if (users.some((user) => user.email === email)) {
    return res
      .status(400)
      .json({ status: "error", message: "Email already registered" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  // Create a new admin user
  const newAdmin = {
    id: `admin-${uuidv4()}`,
    name,
    email,
    password: hashedPassword,
    avatar: `https://generated-image-url.jpg`,
  };

  users.push(newAdmin);

  res
    .status(201)
    .json({
      status: "success",
      message: "Admin created",
      data: { user: newAdmin },
    });
});


// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);

  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, email: user.email }, "secret");

    res.json({ status: "success", message: "ok", data: { token } });
  } else {
    res.status(401).json({ status: "error", message: "Invalid credentials" });
  }
});

// See all users
app.get("/users", (req, res) => {
  const userData = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  }));

  res.json({ status: "success", message: "ok", data: { users: userData } });
});

// See own profile
app.get("/users/me", authenticateToken, (req, res) => {
  const user = users.find((user) => user.id === req.user.id);

  res.json({ status: "success", message: "ok", data: { user } });
});

// Create Thread
app.post("/threads", authenticateToken, (req, res) => {
  const { title, body, category } = req.body;

  const newThread = {
    id: `thread-${uuidv4()}`,
    title,
    body,
    category: category || "General",
    createdAt: new Date().toISOString(),
    ownerId: req.user.id,
    upVotesBy: [],
    downVotesBy: [],
    totalComments: 0,
  };

  threads.push(newThread);

  res.json({
    status: "success",
    message: "Thread created",
    data: { thread: newThread },
  });
});

// See All Threads
app.get("/threads", (req, res) => {
  res.json({ status: "success", message: "ok", data: { threads } });
});

// See Detail Thread
app.get("/threads/:threadId", (req, res) => {
  const threadId = req.params.threadId;
  const detailThread = threads.find((thread) => thread.id === threadId);

  if (detailThread) {
    const {
      id,
      title,
      body,
      category,
      createdAt,
      ownerId,
      upVotesBy,
      downVotesBy,
      totalComments,
    } = detailThread;

    const owner = users.find((user) => user.id === ownerId);

    const comments = [];

    const response = {
      status: "success",
      message: "ok",
      data: {
        detailThread: {
          id,
          title,
          body,
          category,
          createdAt,
          owner: { id: owner.id, name: owner.name, avatar: owner.avatar },
          upVotesBy,
          downVotesBy,
          comments,
        },
      },
    };

    res.json(response);
  } else {
    res.status(404).json({ status: "error", message: "Thread not found" });
  }
});

// Create Comment
app.post("/threads/:threadId/comments", authenticateToken, (req, res) => {
  const threadId = req.params.threadId;
  const { content } = req.body;

  const newComment = {
    id: `comment-${uuidv4()}`,
    content,
    createdAt: new Date().toISOString(),
    upVotesBy: [],
    downVotesBy: [],
    owner: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
  };

  // Find the thread and add the comment
  const thread = threads.find((thread) => thread.id === threadId);

  if (thread) {
    thread.totalComments += 1;
    thread.comments.push(newComment);

    comments.push(newComment);

    res.json({
      status: "success",
      message: "Comment created",
      data: { comment: newComment },
    });
  } else {
    res.status(404).json({ status: "error", message: "Thread not found" });
  }
});

// Up-vote Thread
app.post("/threads/:threadId/up-vote", authenticateToken, (req, res) => {
  const threadId = req.params.threadId;

  const vote = findOrCreateVote(req.user.id, threadId, "thread");
  vote.voteType = 1;

  res.json({ status: "success", message: "Thread upvoted", data: { vote } });
});

// Down-vote Thread
app.post("/threads/:threadId/down-vote", authenticateToken, (req, res) => {
  const threadId = req.params.threadId;

  const vote = findOrCreateVote(req.user.id, threadId, "thread");
  vote.voteType = -1;

  res.json({ status: "success", message: "Thread downvoted", data: { vote } });
});

// Neutralize Thread vote
app.post("/threads/:threadId/neutral-vote", authenticateToken, (req, res) => {
  const threadId = req.params.threadId;

  const vote = findOrCreateVote(req.user.id, threadId, "thread");
  vote.voteType = 0;

  res.json({
    status: "success",
    message: "Thread vote neutralized",
    data: { vote },
  });
});

// Up-vote Comment
app.post(
  "/threads/:threadId/comments/:commentId/up-vote",
  authenticateToken,
  (req, res) => {
    const commentId = req.params.commentId;

    const vote = findOrCreateVote(req.user.id, commentId, "comment");
    vote.voteType = 1;

    res.json({ status: "success", message: "Comment upvoted", data: { vote } });
  }
);

// Down-vote Comment
app.post(
  "/threads/:threadId/comments/:commentId/down-vote",
  authenticateToken,
  (req, res) => {
    const commentId = req.params.commentId;

    const vote = findOrCreateVote(req.user.id, commentId, "comment");
    vote.voteType = -1;

    res.json({
      status: "success",
      message: "Comment downvoted",
      data: { vote },
    });
  }
);

// Neutralize Comment vote
app.post(
  "/threads/:threadId/comments/:commentId/neutral-vote",
  authenticateToken,
  (req, res) => {
    const commentId = req.params.commentId;

    const vote = findOrCreateVote(req.user.id, commentId, "comment");
    vote.voteType = 0;

    res.json({
      status: "success",
      message: "Comment vote neutralized",
      data: { vote },
    });
  }
);

// Leaderboards
app.get("/leaderboards", (req, res) => {
  // Calculate score based on upvotes and downvotes
  const calculateScore = (upVotes, downVotes) =>
    upVotes.length - downVotes.length;

  const leaderboards = users.map((user) => ({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
    score: calculateScore(
      votes
        .filter(
          (vote) =>
            vote.userId === user.id &&
            vote.voteType === 1 &&
            vote.commentId === undefined
        )
        .map((vote) => vote.threadId),
      votes
        .filter(
          (vote) =>
            vote.userId === user.id &&
            vote.voteType === -1 &&
            vote.commentId === undefined
        )
        .map((vote) => vote.threadId)
    ),
  }));

  // Sort leaderboards by score
  leaderboards.sort((a, b) => b.score - a.score);

  res.json({ status: "success", message: "ok", data: { leaderboards } });
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});

module.exports = app
