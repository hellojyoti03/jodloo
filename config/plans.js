// config/plans.js

const subscriptionPlans = {
    '1_month': {
      id: 'plan_OsimgFYDOv9nc7', // Razorpay Plan ID for 1 month plan
      duration: '1 month',
      plabID: '1_month',
      amount: 99,
      interval: 'monthly',
      interval_count: 1,
      currency: 'INR',
    },
    '3_months': {
      id: 'plan_OsinwWA5gytVJa', // Razorpay Plan ID for 3 months plan
      duration: '3 months',
      plabID: 'plan_OsinwWA5gytVJa',

      amount: 93,
      interval: 'monthly',
      interval_count: 3,
      currency: 'INR',
    },
    '6_months': {
      id: 'plan_OsioipPEcPbAfB', // Razorpay Plan ID for 6 months plan
      duration: '6 months',
      plabID: '6_months',

      amount: 88,
      interval: 'monthly',
      interval_count: 6,
      currency: 'INR',
    },
  };
  
  module.exports = subscriptionPlans;
  