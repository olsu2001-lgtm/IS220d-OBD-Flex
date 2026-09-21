import test from "node:test";
import assert from "node:assert/strict";
import {
  IS220D_LIVE_REFERENCES,
  evaluateIs220dLiveReference,
  inferIs220dLiveContext,
  referenceForIs220dMetric
} from "../src/is220d-live-reference-values.js";

const warmIdle={rpm:800,coolant:85,speed:0};

test("warm idle context is inferred only when warm, running and stationary",()=>{
  assert.equal(inferIs220dLiveContext(warmIdle).idleCandidate,true);
  assert.equal(inferIs220dLiveContext({rpm:800,coolant:60,speed:0}).idleCandidate,false);
  assert.equal(inferIs220dLiveContext({rpm:800,coolant:85,speed:40}).idleCandidate,false);
  assert.equal(inferIs220dLiveContext({rpm:null,coolant:null,speed:null}).keyOn,false);
});

test("rail pressure uses the manual-derived 37-43 MPa warm idle reference",()=>{
  const inside=evaluateIs220dLiveReference("railPressure",40000,warmIdle);
  const outside=evaluateIs220dLiveReference("railPressure",50000,warmIdle);
  assert.equal(inside.status,"within");
  assert.equal(outside.status,"outside");
  assert.equal(referenceForIs220dMetric("railPressure").label,"37–43 MPa");
  assert.equal(evaluateIs220dLiveReference("railPressure",40000,{rpm:1800,coolant:85,speed:50}).status,"not-applicable");
});

test("warm-idle rpm is compared to the injector-test eligibility window without treating it as a universal limit",()=>{
  assert.equal(evaluateIs220dLiveReference("rpm",1000,warmIdle).status,"within");
  assert.equal(evaluateIs220dLiveReference("rpm",1200,{rpm:1200,coolant:85,speed:0}).status,"outside");
  assert.match(referenceForIs220dMetric("rpm").note,/ei yleinen vikakynnys/i);
});

test("coolant minimum is a test condition instead of a fault threshold",()=>{
  const cold=evaluateIs220dLiveReference("coolant",60,{rpm:800,coolant:60,speed:0});
  const warm=evaluateIs220dLiveReference("coolant",85,warmIdle);
  assert.equal(cold.status,"condition-not-met");
  assert.equal(warm.status,"within");
});

test("running voltage is a comparison guide and not a component verdict",()=>{
  assert.equal(evaluateIs220dLiveReference("voltage",14.1,warmIdle).status,"within");
  assert.equal(evaluateIs220dLiveReference("voltage",12.2,warmIdle).status,"outside");
  assert.equal(referenceForIs220dMetric("voltage").kind,"guide-range");
  assert.match(referenceForIs220dMetric("voltage").note,/yleismittarilla/i);
});

test("DPNR KOEO reference is displayed without invented numeric tolerance",()=>{
  const koeo=evaluateIs220dLiveReference("dpnrDifferentialPressure",0.2,{rpm:0,coolant:20,speed:0});
  assert.equal(koeo.status,"reference-only");
  assert.equal(koeo.reference.target,0);
  assert.equal("min" in koeo.reference,false);
  assert.equal(evaluateIs220dLiveReference("dpnrDifferentialPressure",0.2,warmIdle).status,"not-applicable");
});

test("injector correction keeps typical and service thresholds distinct",()=>{
  assert.equal(evaluateIs220dLiveReference("injectionFeedback1",2.5,warmIdle).status,"within");
  assert.equal(evaluateIs220dLiveReference("injectionFeedback2",3.5,warmIdle).status,"attention");
  assert.equal(evaluateIs220dLiveReference("injectionFeedback4",5.2,warmIdle).status,"outside");
  assert.equal(referenceForIs220dMetric("injectionFeedback3"),IS220D_LIVE_REFERENCES.injectionFeedback1);
});
