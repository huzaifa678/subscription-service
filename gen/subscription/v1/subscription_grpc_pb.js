// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var subscription_v1_subscription_pb = require('../../subscription/v1/subscription_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');

function serialize_subscription_v1_GetSubscriptionRequest(arg) {
  if (!(arg instanceof subscription_v1_subscription_pb.GetSubscriptionRequest)) {
    throw new Error('Expected argument of type subscription.v1.GetSubscriptionRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_subscription_v1_GetSubscriptionRequest(buffer_arg) {
  return subscription_v1_subscription_pb.GetSubscriptionRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_subscription_v1_GetSubscriptionResponse(arg) {
  if (!(arg instanceof subscription_v1_subscription_pb.GetSubscriptionResponse)) {
    throw new Error('Expected argument of type subscription.v1.GetSubscriptionResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_subscription_v1_GetSubscriptionResponse(buffer_arg) {
  return subscription_v1_subscription_pb.GetSubscriptionResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_subscription_v1_GetUserActiveSubscriptionsRequest(arg) {
  if (!(arg instanceof subscription_v1_subscription_pb.GetUserActiveSubscriptionsRequest)) {
    throw new Error('Expected argument of type subscription.v1.GetUserActiveSubscriptionsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_subscription_v1_GetUserActiveSubscriptionsRequest(buffer_arg) {
  return subscription_v1_subscription_pb.GetUserActiveSubscriptionsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_subscription_v1_GetUserActiveSubscriptionsResponse(arg) {
  if (!(arg instanceof subscription_v1_subscription_pb.GetUserActiveSubscriptionsResponse)) {
    throw new Error('Expected argument of type subscription.v1.GetUserActiveSubscriptionsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_subscription_v1_GetUserActiveSubscriptionsResponse(buffer_arg) {
  return subscription_v1_subscription_pb.GetUserActiveSubscriptionsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var SubscriptionServiceService = exports.SubscriptionServiceService = {
  getSubscription: {
    path: '/subscription.v1.SubscriptionService/GetSubscription',
    requestStream: false,
    responseStream: false,
    requestType: subscription_v1_subscription_pb.GetSubscriptionRequest,
    responseType: subscription_v1_subscription_pb.GetSubscriptionResponse,
    requestSerialize: serialize_subscription_v1_GetSubscriptionRequest,
    requestDeserialize: deserialize_subscription_v1_GetSubscriptionRequest,
    responseSerialize: serialize_subscription_v1_GetSubscriptionResponse,
    responseDeserialize: deserialize_subscription_v1_GetSubscriptionResponse,
  },
  getUserActiveSubscriptions: {
    path: '/subscription.v1.SubscriptionService/GetUserActiveSubscriptions',
    requestStream: false,
    responseStream: false,
    requestType: subscription_v1_subscription_pb.GetUserActiveSubscriptionsRequest,
    responseType: subscription_v1_subscription_pb.GetUserActiveSubscriptionsResponse,
    requestSerialize: serialize_subscription_v1_GetUserActiveSubscriptionsRequest,
    requestDeserialize: deserialize_subscription_v1_GetUserActiveSubscriptionsRequest,
    responseSerialize: serialize_subscription_v1_GetUserActiveSubscriptionsResponse,
    responseDeserialize: deserialize_subscription_v1_GetUserActiveSubscriptionsResponse,
  },
};

exports.SubscriptionServiceClient = grpc.makeGenericClientConstructor(SubscriptionServiceService, 'SubscriptionService');
