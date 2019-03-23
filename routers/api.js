const express = require("express")
const router = new express.Router()
const jwt = require("jsonwebtoken")
const mysql = require("mysql")
const config = require(`../db-config.json`)
const { hashPassword, authMiddleware } = require("../utils.js")

const { secret } = require("../secret.json");

const pool = mysql.createPool({
  connectionLimit: 10,
  ...config
})

module.exports = pool

router.get(`/events/:id?`, ({ params: { id } , body}, res) => {
  if (typeof id !== "undefined") {
    return pool.query(`SELECT * FROM Events WHERE id=${pool.escape(id)};`, (err, data) => {
      if (err) res.error(err)
      else res.json(data[0])
    })
  }

  //TODO startTime, endTime, name filters
  pool.query(`SELECT * FROM Events;`, (err, data) => {
    if (err) {
      res.error(err)
    } else {
      res.json(data)
    }
  })
})

router.get(`/users/:id?`, ({ params: { id } , body}, res) => {
  if (typeof id !== "undefined") {
    return pool.query(`SELECT id, email, username, name, phone, bio, image FROM Users WHERE id=${pool.escape(id)};`, (err, data) => {
      if (err) res.error(err)
      else res.json(data[0])
    })
  }

  //TODO email, username, name filters
  pool.query(`SELECT id, email, username, name, phone, bio, image FROM Users;`, (err, data) => {
    if (err) {
      res.error(err)
    } else {
      res.json(data)
    }
  })
})

router.get(`/users/:id/events`, ({ params: { id } , body}, res) => {
    pool.query(`SELECT userId, eventId FROM Users_Events_th WHERE userId=${pool.escape(id)};`, (err, data) => {
      if (err) {
        res.error(err)
      } else {
        res.json(data)
      }
    })
})

router.get(`/events/:id/users`, ({ params: { id } , body}, res) => {
  pool.query(`SELECT userId, eventId FROM Users_Events_th WHERE eventId=${pool.escape(id)};`, (err, data) => {
    if (err) {
      res.error(err)
    } else {
      res.json(data)
    }
  })
})

router.post("/users", ({ body }, res) => {
  body.password = hashPassword(`${body.password}`)

  //todo verify base64 image and other fields
  pool.query(`SELECT email FROM Users WHERE email=${pool.escape(body.email)} or username=${pool.escape(body.username)}`, (err, results) => {
    if (err) {
      res.error(err)
    } else {
      if (!results.length) {
        pool.query(`INSERT INTO Users SET ?`, body, (err, results) => {
          if (err) {
            res.error(err)
          } else {
            res.status(201).json({ message: "user created" })
          }
        })
      } else {
        res.status(400).json({ message: "email or username already in-use" })
      }
    }
  })
})

router.post("/authentication", ({ body: { email, password } }, res) => {
  pool.query(`SELECT id FROM Users WHERE email=${pool.escape(email)} AND password="${hashPassword(password)}"`, (err, results) => {
    if (err) {
      return res.error(err)
    }

    if (results.length === 1) {
      const token = jwt.sign({
        id: results[0].id
      }, secret, { algorithm: "HS512" })

      res.json({token})
    } else {
      res.status(401).json({ message: "wrong email or password"})
    }
  })
})

router.post("/events", authMiddleware, ({ body, token }, res) => {
  body.creatorId = token.id
  //todo check event starttime and endtime
  pool.query(`INSERT INTO Events SET ?`, body, (err, results) => {
    if (err) {
      res.error(err)
    } else {
      res.status(201).json({ message: "event created" })
    }
  })
})

router.delete("/events/:id", authMiddleware, ({ params: { id }, token }, res) => {
  //todo check event starttime and endtime (event must not be expired)
  pool.query(`DELETE FROM Events WHERE id = ${pool.escape(id)} AND creatorId = ${pool.escape(token.id)}`, (err, results) => {
    if (err) {
      res.error(err)
    } else {
      if (results.affectedRows)
        res.status(201).json({ message: "event deleted" })
      else
        res.error(`no event with id ${id} and creatorId ${token.id} exists`)
    }
  })
})

router.post("/events/:id/users", authMiddleware, ({ params: { id }, token}, res) => {
  //todo check event starttime and endtime (event must not be expired)
  pool.query(`INSERT INTO Users_Events_th VALUES(DEFAULT, ${token.id}, ${id}`, (err, results) => {
    if (err) {
      res.error(err)
    } else {
      res.status(201).json({ message: "event attended by user" })
    }
  })
})

router.delete("/events/:id/users", authMiddleware, ({ params: { id }, token}, res) => {
  //todo check event starttime and endtime (event must not be expired /started?)
  pool.query(`DELETE FROM Users_Events_th WHERE userId = ${token.id} AND eventId = ${id}`, (err, results) => {
    if (err) {
      res.error(err)
    } else {
      res.status(201).json({ message: "event attended by user" })
    }
  })
})

module.exports = router

