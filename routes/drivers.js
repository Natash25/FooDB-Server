const Router = require('express-promise-router')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const db = require('../db')

// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router()

// export our router to be mounted by the parent application
module.exports = router

// General endpoints for all deliverers
router.get('/list', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM driver') // Show all deliverers
  res.send(rows)
})

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body
  if (email && password && phone) {
    const hashedPassword = bcrypt.hashSync(password, 8)

    try {
      const { rows } = await db.query('INSERT INTO "driver" (name, email, password, phone_num) VALUES($1, $2, $3, $4) RETURNING *', [name, email, hashedPassword, phone])
      const driverId = rows[0].driver_id

      const token = jwt.sign({id: driverId}, process.env.SESSION_SECRET, {
        expiresIn: 86400 // expires in 24 hours
      })

      res.status(200).send({auth: true, token: token})
    } catch (e) {
      console.log(e)
      if (e.routine == '_bt_check_unique')
        return res.status(409).send({auth: false, error: 'Driver with the same email already exists.'})
      res.status(500).send({auth: false, error: 'There was an error creating your account.'})
    }
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (email && password) {
    let { rows } = await db.query('SELECT driver_id, email, password FROM "driver" WHERE email = $1', [email])

    if (!rows[0]) {
      return res.status(404).send('No user found.')
    }

    if(bcrypt.compareSync(password, rows[0].password)) {
      let token = jwt.sign({id: rows[0].driver_id}, process.env.SESSION_SECRET, {
        expiresIn: 86400 // expires in 24 hours
      })
      res.status(200).send({auth: true, token: token})
    } else {
      res.status(401).send({ auth: false, token: null })
    }
  }
})

//
router.post('/:id/update/phone', async (req, res) => {
  const id = req.params
  const token = req.headers['authorization']
  const email = req.body
  if (!token) return res.status(401).send({auth: false, message: 'No token provided'})
  if (phone) {
    try {
      const { id } = jwt.verify(token.split(" ")[1], process.env.SESSION_SECRET) // get driver id
      const { rows } = await db.query('UPDATE driver SET phone_num = $1 WHERE driver_id = $2', [email, id])
      res.send(rows[0])
    } catch (e) {
      console.log(e)
      res.status(500).send({auth: false, error: 'Failed to authenticate token.'})
    }
  }

})

// Endpoint for getting deliverer info
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const { rows } = await db.query('SELECT name, phone_num, lat, lon FROM driver WHERE driver_id = $1', [id])
  res.send(rows[0])
})

router.get('/:id/vehicles', async (req, res) => {
  const { id } = req.params
  const { rows } = await db.query('SELECT name, phone_num, license_plate, make, model, color, year, since' +
    ' FROM driver D, drives DR, vehicle V' +
    ' WHERE D.driver_id = DR.driver_id AND' +
    ' DR.driver_id = V.driver_id AND' +
    ' D.driver_id = $1', [id])
  res.send(rows[0])
})


