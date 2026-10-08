
import { defineAuth } from '@aws-amplify/backend';

/**
 * Sign-in with email. The "Admins" group is created automatically;
 * people in this group can add and delete products.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admins'],
});
