# FORMA subscriptions

FORMA Plus contains adaptive weekly planning, progression suggestions based on completed training, custom routines, and unlimited saved workouts. Free includes the exercise library, workout logging, training history, account sync, and three saved workouts.

The app has native RevenueCat and RevenueCat Web SDK integrations. Real prices and billing periods come from the current RevenueCat offering. Live checkout, restore access, active entitlements, and membership management use the relevant SDK. No provider accounts, live products, public SDK keys, or deployed webhook have been provisioned in this workspace.

## Review Plus locally

Open the development app through localhost or 127.0.0.1, finish onboarding, and choose **Try Plus in preview — no charge**. Membership is also available from the main navigation/profile. The paywall offers annual/monthly selection and a Free/Plus comparison.

When no real offering is loaded in this local development preview, src/lib/membership.ts supplies illustrative prices of ₹399/month and ₹1,999/year. These are visibly labeled **Preview prices · Illustrative · no charge**. They are product decisions for review, not purchasable products or a claim that billing has been configured. The displayed annual saving and monthly equivalent are calculated from those amounts.

Preview activation uses a separate local state, never calls a purchase API, and never writes a paid entitlement. **End preview and return to Free** reverses it. The app shows a Plus preview badge throughout the experience. The preview entry requires a development web build on a loopback hostname. Production exports, hosted builds, and native builds cannot activate this local preview through the UI. Purchasable prices always come from RevenueCat.

## App configuration

Set public SDK values in the Expo build environment:

    EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_public_apple_sdk_key
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_public_google_sdk_key
    EXPO_PUBLIC_REVENUECAT_WEB_KEY=your_public_web_sdk_key
    EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=forma_pro

Use separate app-specific public SDK keys. Keep all RevenueCat secret keys, store credentials, and webhook authorization secrets on the server or in provider dashboards. Expo embeds EXPO_PUBLIC_* values in the app. Restart/rebuild after configuration changes.

Native billing requires the native RevenueCat module in an iOS or Android development/store build. Expo Go is deliberately unsupported because its billing preview may return mock responses. The web integration dynamically loads @revenuecat/purchases-js only when a public web key is configured. A missing web key leaves checkout unavailable and preserves Free training. A configured key does not prove that products, the billing gateway, or payment credentials are ready. See [RevenueCat SDK configuration](https://www.revenuecat.com/docs/getting-started/configuring-sdk), [Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo), and [Web SDK](https://www.revenuecat.com/docs/web/web-billing/web-sdk).

## Account lifecycle

Use initializePurchases(session.user.id) with the immutable ID issued by FORMA's backend. The same account ID links purchases and access across web, iOS, and Android. Never use email or a device identifier as the customer ID.

An omitted argument preserves identity; explicit null signs the billing customer out. Native uses RevenueCat login/logout. Web switches users using changeUser, using a fresh anonymous ID when signing out. Identity and payment operations are serialized, and asynchronous entitlement results carry an identity revision so they cannot grant the previous customer's membership to a newly selected account. Checkout and restore require a signed-in FORMA account. Anonymous SDK configuration is only used to browse offers.

Load getSubscriptionOffers() after identification, display its returned prices/periods, and purchase its package ID. Reloading offerings or changing accounts clears the package cache. One-time products are omitted. Native price and period metadata come from store products; web reads webBillingProduct.price, period, and the default subscription option. No checkout uses the local preview price objects.

A purchase succeeds only when its returned RevenueCat customer information includes active forma_pro. Cancellation returns false; checkout finishing without that entitlement also returns false. Errors do not activate access. The UI never promises a free trial: checkout confirms any actual eligible offers. Native purchase restoration invokes the store SDK. Web restoration refreshes the signed-in customer's entitlements. Membership management opens the provider URL returned by RevenueCat customer information. See [customer identity](https://www.revenuecat.com/docs/customers/identifying-customers) and [Web SDK purchasing](https://www.revenuecat.com/docs/web/web-billing/web-sdk).

## Configure actual revenue

1. Create FORMA's iOS/Android apps with identifiers matching the native build. Complete store agreements, tax/banking, and product configuration.
2. Create monthly and annual auto-renewing products and their real prices in App Store Connect and Play Console. Connect the store credentials and server notifications in RevenueCat.
3. For browser checkout, create a RevenueCat Web configuration and connect a supported payment provider. The RevenueCat Billing route uses a connected Stripe account. Create web products and their real currency/price settings.
4. Attach all platform products to the same forma_pro entitlement in one RevenueCat project.
5. Create the current offering, connecting monthly and annual packages to the right products on each platform. Verify the real SDK prices and periods. Use the same backend customer ID on every platform.
6. Configure the deployed HTTPS webhook and its backend-only authorization secret. Keep sandbox and production environments separate.
7. Supply the app's public SDK keys, rebuild, and verify native sandbox and web sandbox checkout before turning on live sales.

RevenueCat documents the [Web SDK setup](https://www.revenuecat.com/docs/web/web-billing/web-sdk), [entitlements](https://www.revenuecat.com/docs/getting-started/entitlements), [offerings](https://www.revenuecat.com/docs/getting-started/displaying-products), and [restore policy](https://www.revenuecat.com/docs/projects/restore-behavior). Actual product creation, provider setup, public legal/support pages, tax/receipt settings, and account agreements remain launch tasks.

## Webhook and server access

RevenueCat posts to /api/revenuecat/webhook on the deployed API. The matching webhook secret stays in the backend environment. Events map to the same backend user ID used by the SDK. The implemented handler authenticates events, records event IDs, handles ordering and expiry, and separates sandbox/production access.

Client-side feature gates improve the product flow; any future paid server-side computation or content endpoint must separately enforce the server's verified entitlement. A local preview flag is never a server billing entitlement. See [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks).

## Verification before launch

Test real iOS/Android sandbox builds and the configured web sandbox. Verify localized monthly/annual prices, successful purchase, cancellation, pending/rejected payment, offline errors, restore after reinstall/sign-in, account switching, billing management, renewal, expiration, refund, and webhook delivery. Inspect the relevant provider receipt and RevenueCat customer record; an animation is not payment evidence.

Local preview activation verifies the paid feature experience. Typechecking and Expo exports verify compilation. Neither verifies a real transaction, provider configuration, native device behavior, or webhook delivery. These require the configured billing environments. See [RevenueCat testing use cases](https://www.revenuecat.com/docs/guides/testing-guide/use-cases) and [web purchase testing](https://www.revenuecat.com/docs/web/web-billing/testing).
