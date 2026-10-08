import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // Products: any signed-in user can read; only Admins can create, edit, delete.
  Product: a
    .model({
      name: a.string().required(),
      description: a.string(),
      price: a.float().required(),
      imageUrl: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.group('Admins'),
    ]),

  // Cart: each shopper only sees and changes their own items.
  CartItem: a
    .model({
      productId: a.string().required(),
      name: a.string(),
      price: a.float(),
      quantity: a.integer().required(),
    })
    .authorization((allow) => [allow.owner()]),

  // Orders: shoppers can place and view their own orders.
  // Admins can see and update all orders (for example to mark them shipped).
  Order: a
    .model({
      items: a.string().required(), // JSON text of the ordered items
      total: a.float().required(),
      status: a.string().required(),
    })
    .authorization((allow) => [
      allow.owner().to(['create', 'read']),
      allow.group('Admins'),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
