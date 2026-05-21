const test = require('ava');
const runPlugin = require('kap-plugin-test');

const {shareServices} = require('../');

test('share service exposes Telegram entry', t => {
  t.is(shareServices.length, 1);
  const [service] = shareServices;
  t.is(service.title, 'Share to Telegram');
  t.deepEqual(service.formats, ['mp4', 'hevc', 'av1', 'gif', 'apng', 'webm']);
  t.is(typeof service.action, 'function');
  t.truthy(service.config.backendUrl);
});

test('action notifies when backendUrl is empty', async t => {
  const {context, run} = runPlugin('foo.mp4', {config: {backendUrl: ''}});
  await run();
  t.true(context.notify.calledWithMatch(/backendUrl/));
});

test('action uploads using an existing token without re-auth', async t => {
  const {context, run} = runPlugin('foo.mp4', {
    config: {backendUrl: 'https://example.com'}
  });
  context.config.set('uploadToken', 'tok-123');

  // С токеном в конфиге авторизация пропускается; перехватываем /upload.
  let uploadCalled = false;
  context.request.callsFake(async url => {
    if (url.endsWith('/upload')) {
      uploadCalled = true;
      return {};
    }
    throw new Error(`unexpected request to ${url}`);
  });

  await run();

  t.true(uploadCalled);
  t.true(context.notify.calledWithMatch(/отправлено/));
});

test('action clears token and re-prompts on 401', async t => {
  const {context, run} = runPlugin('foo.mp4', {
    config: {backendUrl: 'https://example.com'}
  });
  context.config.set('uploadToken', 'tok-bad');

  context.request.callsFake(async url => {
    if (url.endsWith('/upload')) {
      const error = new Error('401');
      error.response = {statusCode: 401};
      throw error;
    }
    throw new Error(`unexpected request to ${url}`);
  });

  await run();

  t.is(context.config.get('uploadToken'), '');
  t.true(context.notify.calledWithMatch(/истекла/));
});
