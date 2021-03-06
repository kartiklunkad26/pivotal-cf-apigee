'use strict'
/**
 * Copyright (C) 2016 Apigee Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Implementation of [service broker API for CF](http://docs.cloudfoundry.org/services/api.html)
 *
 * @example
 * sample provisioning request:
 * {
 *   "service_id"        : "5E3F917B-9225-4BE4-802F-8F1491F714C0",
 *   "plan_id"           : "D4D617E1-B4F9-49C7-91C8-52AB9DE8C18F",
 *   "organization_guid" : "885e653c-1e90-4a09-bc2e-5cbb39ceccf1",
 *   "space_guid"        : "ab17b10a-6765-4c3e-b00f-4f8358c6b185",
 *   "parameters"        : {"org" : "cdmo"}
 * }
 *
 * @module
 */

var config = require('../helpers/config')
var express = require('express')
var router = express.Router()
var validate = require('express-jsonschema').validate
var bindingSchema = require('../schemas/service_binding')
var auth = require('../helpers/auth')(config)
var catalogData = require('../helpers/catalog_data')
var service_binding = require('../helpers/service_binding')
var logger = require('../helpers/logger')
var log = require('bunyan').createLogger({name: 'apigee', src: true})

router.use(auth)

// plan schema validation
function planValidate (req, res, next) {
  var loggerError
  if (req.body.plan_id === catalogData.guid.org) {
    // org plan
    // if (!req.body.parameters.hasOwnProperty('host')) {
    //   res.status(400)
    //   loggerError = logger.ERR_ORG_PLAN_REQUIRES_HOST()
    //   res.json(loggerError)
    // } else {
      next()
    // }
  } else if (req.body.plan_id === catalogData.guid.micro) {
    // micro plan
    if (!req.body.parameters.hasOwnProperty('micro')) {
      res.status(400)
      loggerError = logger.ERR_MICRO_PLAN_REQUIRES_MICRO()
      res.json(loggerError)
    } else {
      next()
    }
  } else {
    // unknown plan
    res.status(400)
    loggerError = logger.ERR_INVALID_SERVICE_PLAN()
    res.json(loggerError)
  }
}

function authValidate (req, res, next) {
  const params = req.body.parameters;
  if (params.user && params.pass) {
    next()
  } else if (params.basic) {
    next()
  } else if (params.bearer) {
    next()
  } else {
    res.status(400)
    var loggerError = logger.ERR_MISSING_AUTH()
    res.json(loggerError)
  }
}

// provising a service instance
router.put('/:instance_id', function (req, res) {
  // TODO instance-specific dashboard_url
  var r = {dashboard_url: config.get('APIGEE_DASHBOARD_URL')}
  log.info({response: r}, 'create service instance response')
  res.status(201).json(r)
})

// update a service instance
router.patch('/:instance_id', function (req, res) {
  res.status(422).json({description: 'Automatic plan changes are not supported today. Please contact Apigee Support.'})
})

// deprovision a service instance
router.delete('/:instance_id', function (req, res) {
  res.json({})
})

// create binding
// sample request to PUT /cf-apigee-broker/v2/service_instances/5a76d1c5-4bc3-455a-98b1-e3c079dc5cb2/service_bindings/7ed4c3d3-c3a4-41b6-9acc-72b3a7fa2f39
// payload {"service_id":"5E3F917B-9225-4BE4-802F-8F1491F714C0","plan_id":"D4D617E1-B4F9-49C7-91C8-52AB9DE8C18F","bind_resource":{"route":"rot13.apigee-cloudfoundry.com"}}
// response should be route_service_url	string	A URL to which Cloud Foundry should proxy requests for the bound route.
router.put('/:instance_id/service_bindings/:binding_id',
    validate({body: bindingSchema.bind}), planValidate, authValidate, function (req, res) {
  // use instance_id to retrieve org and environment for proxy
  var bindReq = {
    instance_id: req.params.instance_id,
    binding_id: req.params.binding_id,
    service_id: req.body.service_id,
    plan_id: req.body.plan_id,
    bind_resource: req.body.bind_resource,
    org: req.body.parameters.org,
    env: req.body.parameters.env,
    user: req.body.parameters.user,
    pass: req.body.parameters.pass,
    basic: req.body.parameters.basic,
    bearer: req.body.parameters.bearer,
    micro: req.body.parameters.micro,
    host: req.body.parameters.host
  }
  // create proxy in org that handles the url (bind_resource.route) and dynamically sets target
  service_binding.create(bindReq, function (err, result) {
    if (err) {
      res.status(err.statusCode || 500).json(err)
    } else {
      var r = {credentials: {}, route_service_url: result.proxyURL}
      res.status(201).json(r)
    }
  })
})

// delete binding
router.delete('/:instance_id/service_bindings/:binding_id', function (req, res) {
  res.json({})
})

/**
 * Router for `/service_instances`
 * @type express.Router
 */
module.exports = router
