import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const loginData = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-login.json', import.meta.url), 'utf8'),
);
const bzbAuthData = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-bzb-auth.json', import.meta.url), 'utf8'),
);
const rewardBzbAuthData = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-bzb-auth-reward.json', import.meta.url), 'utf8'),
);
const expectedBanners = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-expected-banners.json', import.meta.url), 'utf8'),
);
const expectedExpiredBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-expired-banner.json', import.meta.url), 'utf8'),
);
const expectedInsiderBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-insider-expected.json', import.meta.url), 'utf8'),
);
const expectedInfluencerBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-influencer-expected.json', import.meta.url), 'utf8'),
);
const expectedAmbassadorBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-ambassador-expected.json', import.meta.url), 'utf8'),
);
const expectedInsiderInfluencerBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-insider-influencer-expected.json', import.meta.url), 'utf8'),
);
const expectedHiddenInsiderBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-insider-hidden-expected.json', import.meta.url), 'utf8'),
);
const expectedTravellerBanner = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-traveller-expected.json', import.meta.url), 'utf8'),
);
const expectedHiddenJanuaryBanners = JSON.parse(
  readFileSync(new URL('../../test-data/retailbanner-january-hidden-expected.json', import.meta.url), 'utf8'),
);
const expectedGuestBanners = JSON.parse(
  readFileSync(new URL('../../test-data/dashboard-guest-expected.json', import.meta.url), 'utf8'),
);
const expectedLuckyDraw = JSON.parse(
  readFileSync(new URL('../../test-data/lucky-draw-expected.json', import.meta.url), 'utf8'),
);
const expectedZeroLuckyDraw = JSON.parse(
  readFileSync(new URL('../../test-data/lucky-draw-zero-expected.json', import.meta.url), 'utf8'),
);

async function loginWithCredentials(request, identifier, identityPassword, identifierName, passwordName) {
  const required = [
    ['API_BASE_URL', process.env.API_BASE_URL],
    [identifierName, identifier],
    [passwordName, identityPassword],
    ['LOGIN_PASSWORD_HASH', process.env.LOGIN_PASSWORD_HASH],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  expect(missing, `Set these variables in .env: ${missing.join(', ')}`).toEqual([]);

  const response = await request.post('/ob-iam/auth/login', {
    headers: {
      'Content-Type': 'application/json',
      'app-version': '2.1.2',
    },
    data: {
      identity: {
        ...loginData.identity,
        identifier,
        password: identityPassword,
      },
      device: loginData.device,
      push_token: loginData.push_token,
      password: process.env.LOGIN_PASSWORD_HASH,
    },
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  const token = body?.data?.token?.value ?? body?.data?.token ?? body?.token?.value ?? body?.token;
  expect(token, 'Login response should contain a token value').toEqual(expect.any(String));
  expect(token.length).toBeGreaterThan(0);
  return token;
}

async function login(request) {
  return loginWithCredentials(
    request,
    process.env.LOGIN_EMAIL_INFLU,
    process.env.LOGIN_IDENTITY_PASSWORD,
    'LOGIN_EMAIL_INFLU',
    'LOGIN_IDENTITY_PASSWORD',
  );
}

async function getBzbAccessKey(request, accessToken, requestData = bzbAuthData) {
  const response = await request.post('/ob-iam/bzb/auth', {
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Token': `Bearer ${accessToken}`,
      'accept-language': 'th',
    },
    data: requestData,
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  const accessKey = body?.data?.accesskey ?? body?.data?.accessKey ?? body?.accesskey ?? body?.accessKey;
  expect(accessKey, 'BZB auth response should contain an access key').toEqual(expect.any(String));
  expect(accessKey.length).toBeGreaterThan(0);
  return accessKey;
}

async function getRetailBannerResponseForAccount(
  request,
  identifier,
  identityPassword,
  identifierName,
  passwordName,
) {
  const token = await loginWithCredentials(
    request,
    identifier,
    identityPassword,
    identifierName,
    passwordName,
  );
  const accessKey = await getBzbAccessKey(request, token, rewardBzbAuthData);
  const bannerUrl = process.env.RETAIL_BANNER_URL;
  expect(bannerUrl, 'Set RETAIL_BANNER_URL in .env').toBeTruthy();
  return request.get(bannerUrl, {
    headers: { bzb_access_key: accessKey },
  });
}

async function verifyCombinedTierBanner(request, accounts, expectedLine4) {
  for (const account of accounts) {
    const response = await getRetailBannerResponseForAccount(
      request,
      process.env[account.identifierName],
      process.env[account.passwordName],
      account.identifierName,
      account.passwordName,
    );
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(
      response.status(),
      ngrokError
        ? `${account.tier} banner tunnel returned ${ngrokError}`
        : `${account.tier} banner endpoint should return HTTP 200`,
    ).toBe(200);

    const body = await response.json();
    expect(
      Array.isArray(body?.data),
      `${account.tier} banner response should contain a data array`,
    ).toBe(true);

    const matchingBanner = body.data.find((banner) => banner.line4 === expectedLine4);
    expect.soft(
      matchingBanner,
      `${account.tier} is missing banner with line4 exactly equal to ${expectedLine4}`,
    ).toBeDefined();
    if (matchingBanner) {
      expect.soft(matchingBanner).toMatchObject({ line4: expectedLine4 });
    }
  }
}

async function verifyBannerIsHiddenFromAccounts(request, accounts, bannerCat, expectedLine4) {
  for (const account of accounts) {
    const response = await getRetailBannerResponseForAccount(
      request,
      process.env[account.identifierName],
      process.env[account.passwordName],
      account.identifierName,
      account.passwordName,
    );
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(
      response.status(),
      ngrokError
        ? `${account.tier} banner tunnel returned ${ngrokError}`
        : `${account.tier} banner endpoint should return HTTP 200`,
    ).toBe(200);

    const body = await response.json();
    expect(
      Array.isArray(body?.data),
      `${account.tier} banner response should contain a data array`,
    ).toBe(true);

    const restrictedBanner = body.data.find(
      (banner) =>
        (!bannerCat || String(banner.cat ?? '') === bannerCat) &&
        banner.line4 === expectedLine4,
    );
    const criteria = bannerCat
      ? `cat ${bannerCat} with line4 ${expectedLine4}`
      : `line4 ${expectedLine4}`;
    expect.soft(
      restrictedBanner,
      `${account.tier} must not see banner ${criteria}`,
    ).toBeUndefined();
  }
}

function bannerMatchesCriteria(banner, criteria) {
  return Object.entries(criteria).every(
    ([key, value]) => String(banner?.[key] ?? '') === String(value),
  );
}

function findNestedObject(value, predicate) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findNestedObject(item, predicate);
      if (match) return match;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') return undefined;
  if (predicate(value)) return value;

  for (const item of Object.values(value)) {
    const match = findNestedObject(item, predicate);
    if (match) return match;
  }
  return undefined;
}

async function getBannerDataForAccount(request, account) {
  const response = await getRetailBannerResponseForAccount(
    request,
    process.env[account.identifierName],
    process.env[account.passwordName],
    account.identifierName,
    account.passwordName,
  );
  const ngrokError = response.headers()['ngrok-error-code'];
  expect(
    response.status(),
    ngrokError
      ? `${account.tier} banner tunnel returned ${ngrokError}`
      : `${account.tier} banner endpoint should return HTTP 200`,
  ).toBe(200);

  const body = await response.json();
  expect(
    Array.isArray(body?.data),
    `${account.tier} banner response should contain a data array`,
  ).toBe(true);
  return body.data;
}

async function verifyBannerAccessControl(
  request,
  eligibleAccount,
  restrictedAccounts,
  expectedBanner,
) {
  const criteriaDescription = JSON.stringify(expectedBanner);
  const eligibleData = await getBannerDataForAccount(request, eligibleAccount);
  const eligibleBanner = eligibleData.find((banner) =>
    bannerMatchesCriteria(banner, expectedBanner),
  );

  expect(
    eligibleBanner,
    `Precondition failed: ${eligibleAccount.tier} must see configured banner ${criteriaDescription}`,
  ).toBeDefined();

  for (const account of restrictedAccounts) {
    const data = await getBannerDataForAccount(request, account);
    const restrictedBanner = data.find((banner) =>
      bannerMatchesCriteria(banner, expectedBanner),
    );
    expect.soft(
      restrictedBanner,
      `${account.tier} must not see banner ${criteriaDescription}`,
    ).toBeUndefined();
  }
}

function optionalBannerCat(variableName) {
  const bannerCat = process.env[variableName];
  if (!bannerCat || bannerCat === '12345') {
    test.info().annotations.push({
      type: 'configuration',
      description: `${variableName} is not configured; validating by exact line4 only`,
    });
    return undefined;
  }
  return bannerCat;
}

test.describe('Retailbanner API flow', () => {
  let accessToken;
  let bzbAccessKey;

  test('TC_001: Verify sign in with email and password and receive a token', async ({ request }) => {
    accessToken = await login(request);
  });

  test('TC_002: Verify user can get a BZB access key', async ({ request }) => {
    // The login step also runs when TC_002 is selected on its own.
    accessToken ??= await login(request);
    bzbAccessKey = await getBzbAccessKey(request, accessToken);
  });

  test('TC_003: Verify banner for account "Influencer" ', async ({ request }) => {
    // Run the prerequisite requests when TC_003 is selected on its own.
    if (!bzbAccessKey) {
      accessToken ??= await login(request);
      bzbAccessKey = await getBzbAccessKey(request, accessToken);
    }

    const bannerUrl = process.env.RETAIL_BANNER_URL;
    expect(bannerUrl, 'Set RETAIL_BANNER_URL in .env').toBeTruthy();

    const response = await request.get(bannerUrl, {
      headers: { bzb_access_key: bzbAccessKey },
    });
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(response.status(), ngrokError ? `Banner tunnel returned ${ngrokError}` : 'Banner endpoint should return HTTP 200').toBe(200);

    const body = await response.json();
    expect(Array.isArray(body?.data), 'Banner response should contain a data array').toBe(true);

    for (const expectedBanner of expectedBanners.data) {
      const actualBanner = body.data.find((banner) =>
        banner.type === expectedBanner.type &&
        (expectedBanner.cat ? banner.cat === expectedBanner.cat : banner.url === expectedBanner.url),
      );
      const bannerId = expectedBanner.cat ?? expectedBanner.url;
      expect(actualBanner, `Missing banner ${bannerId}`).toBeDefined();
      expect(actualBanner).toMatchObject(expectedBanner);
    }
  });

  test('TC_004: Verify expired banner for all personas', async ({ request }) => {
    const bannerUrl = process.env.RETAIL_BANNER_URL;
    expect(bannerUrl, 'Set RETAIL_BANNER_URL in .env').toBeTruthy();
    const allPersonaAccessKey = process.env.BANNER_ALL_PERSONA_ACCESS_KEY;
    expect(allPersonaAccessKey, 'Set BANNER_ALL_PERSONA_ACCESS_KEY in .env').toBeTruthy();

    const response = await request.get(bannerUrl, {
      headers: { bzb_access_key: allPersonaAccessKey },
    });
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(
      response.status(),
      ngrokError ? `Banner tunnel returned ${ngrokError}` : 'Banner endpoint should return HTTP 200',
    ).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body?.data), 'Banner response should contain a data array').toBe(true);

    const expiredBanner = body.data.find(
      (banner) => banner.end_date === expectedExpiredBanner.end_date,
    );
    expect(
      expiredBanner,
      `Missing expired banner with end_date ${expectedExpiredBanner.end_date}`,
    ).toBeDefined();
    expect(expiredBanner).toMatchObject(expectedExpiredBanner);
    expect(expiredBanner.end_date).toBeLessThan(Math.floor(Date.now() / 1000));
  });

  test('TC_005: Verify banner for tier Insider only', async ({ request }) => {
    const insiderToken = await loginWithCredentials(
      request,
      process.env.LOGIN_EMAIL_INSIDER,
      process.env.LOGIN_IDENTITY_PASSWORD_INSIDER,
      'LOGIN_EMAIL_INSIDER',
      'LOGIN_IDENTITY_PASSWORD_INSIDER',
    );
    const insiderAccessKey = await getBzbAccessKey(request, insiderToken, rewardBzbAuthData);

    const bannerUrl = process.env.RETAIL_BANNER_URL;
    expect(bannerUrl, 'Set RETAIL_BANNER_URL in .env').toBeTruthy();

    const response = await request.get(bannerUrl, {
      headers: { bzb_access_key: insiderAccessKey },
    });
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(
      response.status(),
      ngrokError ? `Banner tunnel returned ${ngrokError}` : 'Banner endpoint should return HTTP 200',
    ).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body?.data), 'Banner response should contain a data array').toBe(true);

    const insiderBanner = body.data.find(
      (banner) => banner.line4 === expectedInsiderBanner.line4,
    );
    expect(insiderBanner, 'Missing banner with line4 exactly equal to insider').toBeDefined();
    expect(insiderBanner).toMatchObject(expectedInsiderBanner);
  });

  test('TC_006: Verify banner for tier Influencer only', async ({ request }) => {
    const influencerToken = await loginWithCredentials(
      request,
      process.env.LOGIN_EMAIL_INFLUENCER_ONLY,
      process.env.LOGIN_IDENTITY_PASSWORD_INFLUENCER_ONLY,
      'LOGIN_EMAIL_INFLUENCER_ONLY',
      'LOGIN_IDENTITY_PASSWORD_INFLUENCER_ONLY',
    );
    const influencerAccessKey = await getBzbAccessKey(request, influencerToken, rewardBzbAuthData);

    const bannerUrl = process.env.RETAIL_BANNER_URL;
    expect(bannerUrl, 'Set RETAIL_BANNER_URL in .env').toBeTruthy();

    const response = await request.get(bannerUrl, {
      headers: { bzb_access_key: influencerAccessKey },
    });
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(
      response.status(),
      ngrokError ? `Banner tunnel returned ${ngrokError}` : 'Banner endpoint should return HTTP 200',
    ).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body?.data), 'Banner response should contain a data array').toBe(true);

    const influencerBanner = body.data.find(
      (banner) => banner.line4 === expectedInfluencerBanner.line4,
    );
    expect(
      influencerBanner,
      'Missing banner with line4 exactly equal to influencer',
    ).toBeDefined();
    expect(influencerBanner).toMatchObject(expectedInfluencerBanner);
  });

  test('TC_007: Verify banner for tier Ambassador only', async ({ request }) => {
    const response = await getRetailBannerResponseForAccount(
      request,
      process.env.LOGIN_EMAIL_AMBASSADOR_ONLY,
      process.env.LOGIN_IDENTITY_PASSWORD_AMBASSADOR_ONLY,
      'LOGIN_EMAIL_AMBASSADOR_ONLY',
      'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_ONLY',
    );
    const ngrokError = response.headers()['ngrok-error-code'];
    expect(
      response.status(),
      ngrokError ? `Banner tunnel returned ${ngrokError}` : 'Banner endpoint should return HTTP 200',
    ).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body?.data), 'Banner response should contain a data array').toBe(true);

    const ambassadorBanner = body.data.find(
      (banner) => banner.line4 === expectedAmbassadorBanner.line4,
    );
    expect(
      ambassadorBanner,
      'Missing banner with line4 exactly equal to ambassador',
    ).toBeDefined();
    expect(ambassadorBanner).toMatchObject(expectedAmbassadorBanner);
  });

  test('TC_008: Verify banner for tiers Insider and Influencer only', async ({ request }) => {
    const accounts = [
      {
        tier: 'Insider',
        identifier: process.env.LOGIN_EMAIL_INSIDER,
        password: process.env.LOGIN_IDENTITY_PASSWORD_INSIDER,
        identifierName: 'LOGIN_EMAIL_INSIDER',
        passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER',
      },
      {
        tier: 'Influencer',
        identifier: process.env.LOGIN_EMAIL_INFLUENCER_ONLY,
        password: process.env.LOGIN_IDENTITY_PASSWORD_INFLUENCER_ONLY,
        identifierName: 'LOGIN_EMAIL_INFLUENCER_ONLY',
        passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_ONLY',
      },
    ];

    for (const account of accounts) {
      const response = await getRetailBannerResponseForAccount(
        request,
        account.identifier,
        account.password,
        account.identifierName,
        account.passwordName,
      );
      const ngrokError = response.headers()['ngrok-error-code'];
      expect(
        response.status(),
        ngrokError
          ? `${account.tier} banner tunnel returned ${ngrokError}`
          : `${account.tier} banner endpoint should return HTTP 200`,
      ).toBe(200);

      const body = await response.json();
      expect(
        Array.isArray(body?.data),
        `${account.tier} banner response should contain a data array`,
      ).toBe(true);

      const combinedBanner = body.data.find(
        (banner) => banner.line4 === expectedInsiderInfluencerBanner.line4,
      );
      expect.soft(
        combinedBanner,
        `${account.tier} is missing banner with line4 exactly equal to insider,influencer`,
      ).toBeDefined();
      if (combinedBanner) {
        expect.soft(combinedBanner).toMatchObject(expectedInsiderInfluencerBanner);
      }
    }
  });

  test('TC_009: Verify banner for tiers Insider and Ambassador only', async ({ request }) => {
    await verifyCombinedTierBanner(
      request,
      [
        {
          tier: 'Insider',
          identifierName: 'LOGIN_EMAIL_INSIDER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER',
        },
        {
          tier: 'Ambassador',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_ONLY',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_ONLY',
        },
      ],
      'insider,ambassador',
    );
  });

  test('TC_010: Verify banner for tiers Influencer and Ambassador only', async ({ request }) => {
    await verifyCombinedTierBanner(
      request,
      [
        {
          tier: 'Influencer',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_ONLY',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_ONLY',
        },
        {
          tier: 'Ambassador',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_ONLY',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_ONLY',
        },
      ],
      'influencer,ambassador',
    );
  });

  test('TC_011: Verify banner for tiers Insider_jan and Influencer_jan only', async ({ request }) => {
    await verifyCombinedTierBanner(
      request,
      [
        {
          tier: 'Insider_jan',
          identifierName: 'LOGIN_EMAIL_INSIDER_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER_JAN',
        },
        {
          tier: 'Influencer_jan',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_JAN',
        },
      ],
      'insider_jan,influencer_jan',
    );
  });

  test('TC_012: Verify banner for tiers Insider_jan and Ambassador_jan only', async ({ request }) => {
    await verifyCombinedTierBanner(
      request,
      [
        {
          tier: 'Insider_jan',
          identifierName: 'LOGIN_EMAIL_INSIDER_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER_JAN',
        },
        {
          tier: 'Ambassador_jan',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_JAN',
        },
      ],
      'insider_jan,ambassador_jan',
    );
  });

  test('TC_013: Verify banner for tiers Influencer_jan and Ambassador_jan only', async ({ request }) => {
    await verifyCombinedTierBanner(
      request,
      [
        {
          tier: 'Influencer_jan',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_JAN',
        },
        {
          tier: 'Ambassador_jan',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_JAN',
        },
      ],
      'influencer_jan,ambassador_jan',
    );
  });

  test('TC_014: Verify banner for all January tiers', async ({ request }) => {
    await verifyCombinedTierBanner(
      request,
      [
        {
          tier: 'Insider_jan',
          identifierName: 'LOGIN_EMAIL_INSIDER_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER_JAN',
        },
        {
          tier: 'Influencer_jan',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_JAN',
        },
        {
          tier: 'Ambassador_jan',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_JAN',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_JAN',
        },
      ],
      'insider_jan,influencer_jan,ambassador_jan',
    );
  });

  test('TC_015: Verify Influencer, Ambassador and Traveller cannot see Insider banner', async ({ request }) => {
    const insiderBannerCat = optionalBannerCat('INSIDER_ONLY_BANNER_CAT');
    const expectedBanner = {
      ...expectedHiddenInsiderBanner,
      ...(insiderBannerCat ? { cat: insiderBannerCat } : {}),
    };

    await verifyBannerAccessControl(
      request,
      {
        tier: 'Insider',
        identifierName: 'LOGIN_EMAIL_INSIDER',
        passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER',
      },
      [
        {
          tier: 'Influencer',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_NEGATIVE',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_NEGATIVE',
        },
        {
          tier: 'Ambassador',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_NEGATIVE',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_NEGATIVE',
        },
        {
          tier: 'Traveller',
          identifierName: 'LOGIN_EMAIL_TRAVELLER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_TRAVELLER',
        },
      ],
      expectedBanner,
    );
  });

  test('TC_016: Verify Insider, Ambassador and Traveller cannot see Influencer banner', async ({ request }) => {
    const influencerBannerCat = optionalBannerCat('INFLUENCER_ONLY_BANNER_CAT');
    const expectedBanner = {
      ...expectedInfluencerBanner,
      ...(influencerBannerCat ? { cat: influencerBannerCat } : {}),
    };

    await verifyBannerAccessControl(
      request,
      {
        tier: 'Influencer',
        identifierName: 'LOGIN_EMAIL_INFLUENCER_ONLY',
        passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_ONLY',
      },
      [
        {
          tier: 'Insider',
          identifierName: 'LOGIN_EMAIL_INSIDER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER',
        },
        {
          tier: 'Ambassador',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_NEGATIVE',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_NEGATIVE',
        },
        {
          tier: 'Traveller',
          identifierName: 'LOGIN_EMAIL_TRAVELLER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_TRAVELLER',
        },
      ],
      expectedBanner,
    );
  });

  test('TC_017: Verify Insider, Influencer and Traveller cannot see Ambassador banner', async ({ request }) => {
    const ambassadorBannerCat = optionalBannerCat('AMBASSADOR_ONLY_BANNER_CAT');
    const expectedBanner = {
      ...expectedAmbassadorBanner,
      ...(ambassadorBannerCat ? { cat: ambassadorBannerCat } : {}),
    };

    await verifyBannerAccessControl(
      request,
      {
        tier: 'Ambassador',
        identifierName: 'LOGIN_EMAIL_AMBASSADOR_ONLY',
        passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_ONLY',
      },
      [
        {
          tier: 'Insider',
          identifierName: 'LOGIN_EMAIL_INSIDER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER',
        },
        {
          tier: 'Influencer',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_NEGATIVE',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_NEGATIVE',
        },
        {
          tier: 'Traveller',
          identifierName: 'LOGIN_EMAIL_TRAVELLER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_TRAVELLER',
        },
      ],
      expectedBanner,
    );
  });

  test('TC_018: Verify Insider, Influencer and Ambassador cannot see Traveller banner', async ({ request }) => {
    await verifyBannerAccessControl(
      request,
      {
        tier: 'Traveller',
        identifierName: 'LOGIN_EMAIL_TRAVELLER',
        passwordName: 'LOGIN_IDENTITY_PASSWORD_TRAVELLER',
      },
      [
        {
          tier: 'Insider',
          identifierName: 'LOGIN_EMAIL_INSIDER',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER',
        },
        {
          tier: 'Influencer',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_NEGATIVE',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_NEGATIVE',
        },
        {
          tier: 'Ambassador',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_NEGATIVE',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_NEGATIVE',
        },
      ],
      expectedTravellerBanner,
    );
  });

  test('TC_019: Verify non-January DOB Insider cannot see Insider January banner', async ({ request }) => {
    const insiderJanuaryBannerCat = optionalBannerCat('INSIDER_JAN_BANNER_CAT');

    await verifyBannerIsHiddenFromAccounts(
      request,
      [
        {
          tier: 'Insider with non-January DOB',
          identifierName: 'LOGIN_EMAIL_INSIDER_FEB',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INSIDER_FEB',
        },
      ],
      insiderJanuaryBannerCat,
      expectedHiddenJanuaryBanners.insider,
    );
  });

  test('TC_020: Verify non-January DOB Influencer cannot see Influencer January banner', async ({ request }) => {
    const influencerJanuaryBannerCat = optionalBannerCat('INFLUENCER_JAN_BANNER_CAT');

    await verifyBannerIsHiddenFromAccounts(
      request,
      [
        {
          tier: 'Influencer with non-January DOB',
          identifierName: 'LOGIN_EMAIL_INFLUENCER_FEB',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_INFLUENCER_FEB',
        },
      ],
      influencerJanuaryBannerCat,
      expectedHiddenJanuaryBanners.influencer,
    );
  });

  test('TC_021: Verify non-January DOB Ambassador cannot see Ambassador January banner', async ({ request }) => {
    const ambassadorJanuaryBannerCat = optionalBannerCat('AMBASSADOR_JAN_BANNER_CAT');

    await verifyBannerIsHiddenFromAccounts(
      request,
      [
        {
          tier: 'Ambassador with non-January DOB',
          identifierName: 'LOGIN_EMAIL_AMBASSADOR_FEB',
          passwordName: 'LOGIN_IDENTITY_PASSWORD_AMBASSADOR_FEB',
        },
      ],
      ambassadorJanuaryBannerCat,
      expectedHiddenJanuaryBanners.ambassador,
    );
  });

  test("TC_022: Verify the Guest persona sees Guest-only banners", async ({ request }) => {
    const dashboardBaseUrl = process.env.DASHBOARD_API_BASE_URL;
    const appId = process.env.ONEBANGKOK_APP_ID;
    expect(dashboardBaseUrl, 'Set DASHBOARD_API_BASE_URL in .env').toBeTruthy();
    expect(appId, 'Set ONEBANGKOK_APP_ID in .env').toBeTruthy();

    const response = await request.get(
      new URL('/dashboard/onebangkok_home?locale=1054', dashboardBaseUrl).toString(),
      {
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
          'app-id': appId,
          origin: 'https://onebangkok.buzzebees-uat.com',
        },
      },
    );

    expect(response.status(), 'Guest dashboard endpoint should return HTTP 200').toBe(200);

    const body = await response.json();
    expect(Array.isArray(body), 'Guest dashboard response should be an array').toBe(true);

    const campaignRotate = body.find((section) => section.type === 'campaign_rotate');
    expect(
      Array.isArray(campaignRotate?.subcampaigndetails),
      'campaign_rotate should contain a subcampaigndetails array',
    ).toBe(true);

    const guestBanners = campaignRotate.subcampaigndetails.filter(
      (banner) => !banner.line4,
    );
    expect(guestBanners).toEqual(expectedGuestBanners);
  });

  test('TC_023: Verify a user with lucky draws has the expected TotalDrawCount', async ({ request }) => {
    const moduleBaseUrl = process.env.MODULE_API_BASE_URL;
    const appId = process.env.ONEBANGKOK_APP_ID;
    const usernameVariable = expectedLuckyDraw.credentials.usernameEnvironmentVariable;
    const passwordVariable = expectedLuckyDraw.credentials.passwordEnvironmentVariable;
    const username = process.env[usernameVariable];
    const password = process.env[passwordVariable];
    const macAddress = process.env.LUCKY_DRAW_MAC_ADDRESS;
    const required = [
      ['MODULE_API_BASE_URL', moduleBaseUrl],
      ['ONEBANGKOK_APP_ID', appId],
      [usernameVariable, username],
      [passwordVariable, password],
      ['LUCKY_DRAW_MAC_ADDRESS', macAddress],
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    expect(missing, `Set these variables in .env: ${missing.join(', ')}`).toEqual([]);

    expect(
      Number.isInteger(expectedLuckyDraw.TotalDrawCount) && expectedLuckyDraw.TotalDrawCount > 0,
      'TotalDrawCount in lucky-draw-expected.json must be a positive integer',
    ).toBe(true);

    const loginResponse = await request.post(
      new URL('/auth/sso_login', moduleBaseUrl).toString(),
      {
        multipart: {
          username,
          password,
          mac_address: macAddress,
          device_app_id: appId,
          app_id: appId,
        },
      },
    );
    expect(loginResponse.status(), 'SSO login endpoint should return HTTP 200').toBe(200);

    const loginBody = await loginResponse.json();
    const jwt =
      loginBody?.jwt ??
      loginBody?.data?.jwt ??
      loginBody?.jwt_token ??
      loginBody?.data?.jwt_token;
    expect(jwt, 'SSO login response should contain a JWT').toEqual(expect.any(String));
    expect(jwt.split('.'), 'JWT should contain header, payload and signature').toHaveLength(3);

    const historyResponse = await request.get(
      new URL('/profile/me/draw_history', moduleBaseUrl).toString(),
      {
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
          'app-id': appId,
          authorization: `Bearer ${jwt}`,
          'cache-control': 'no-cache',
          origin: 'https://onebangkok.buzzebees-uat.com',
          pragma: 'no-cache',
        },
      },
    );
    const historyBody = await historyResponse.json();
    expect(
      historyResponse.status(),
      `Draw history endpoint should return HTTP 200. Response: ${JSON.stringify(historyBody)}`,
    ).toBe(200);

    expect(
      historyBody.TotalDrawCount,
      `TotalDrawCount should equal ${expectedLuckyDraw.TotalDrawCount}`,
    ).toBe(expectedLuckyDraw.TotalDrawCount);

    const campaign = findNestedObject(
      historyBody,
      (item) => item.CampaignName === expectedLuckyDraw.CampaignName,
    );
    expect(
      campaign,
      `Draw history should contain campaign "${expectedLuckyDraw.CampaignName}"`,
    ).toBeDefined();
  });

  test('TC_024: Verify a user with no lucky draws has TotalDrawCount equal to zero', async ({ request }) => {
    const moduleBaseUrl = process.env.MODULE_API_BASE_URL;
    const appId = process.env.ONEBANGKOK_APP_ID;
    const usernameVariable = expectedZeroLuckyDraw.credentials.usernameEnvironmentVariable;
    const passwordVariable = expectedZeroLuckyDraw.credentials.passwordEnvironmentVariable;
    const username = process.env[usernameVariable];
    const password = process.env[passwordVariable];
    const macAddress = process.env.LUCKY_DRAW_ZERO_MAC_ADDRESS;
    const required = [
      ['MODULE_API_BASE_URL', moduleBaseUrl],
      ['ONEBANGKOK_APP_ID', appId],
      [usernameVariable, username],
      [passwordVariable, password],
      ['LUCKY_DRAW_ZERO_MAC_ADDRESS', macAddress],
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    expect(missing, `Set these variables in .env: ${missing.join(', ')}`).toEqual([]);

    expect(
      expectedZeroLuckyDraw.TotalDrawCount,
      'TotalDrawCount in lucky-draw-zero-expected.json must equal zero',
    ).toBe(0);

    const loginResponse = await request.post(
      new URL('/auth/sso_login', moduleBaseUrl).toString(),
      {
        multipart: {
          username,
          password,
          mac_address: macAddress,
          device_app_id: appId,
          app_id: appId,
        },
      },
    );
    expect(loginResponse.status(), 'SSO login endpoint should return HTTP 200').toBe(200);

    const loginBody = await loginResponse.json();
    const jwt =
      loginBody?.jwt ??
      loginBody?.data?.jwt ??
      loginBody?.jwt_token ??
      loginBody?.data?.jwt_token;
    expect(jwt, 'SSO login response should contain a JWT').toEqual(expect.any(String));
    expect(jwt.split('.'), 'JWT should contain header, payload and signature').toHaveLength(3);

    const historyResponse = await request.get(
      new URL('/profile/me/draw_history', moduleBaseUrl).toString(),
      {
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
          'app-id': appId,
          authorization: `Bearer ${jwt}`,
          'cache-control': 'no-cache',
          origin: 'https://onebangkok.buzzebees-uat.com',
          pragma: 'no-cache',
        },
      },
    );
    const historyBody = await historyResponse.json();
    expect(
      historyResponse.status(),
      `Draw history endpoint should return HTTP 200. Response: ${JSON.stringify(historyBody)}`,
    ).toBe(200);
    expect(
      historyBody.TotalDrawCount,
      `TotalDrawCount should equal ${expectedZeroLuckyDraw.TotalDrawCount}`,
    ).toBe(expectedZeroLuckyDraw.TotalDrawCount);

    const campaign = findNestedObject(
      historyBody,
      (item) => item.CampaignName === expectedZeroLuckyDraw.CampaignName,
    );
    expect(
      campaign,
      `Draw history should contain campaign "${expectedZeroLuckyDraw.CampaignName}"`,
    ).toBeDefined();
  });
});
