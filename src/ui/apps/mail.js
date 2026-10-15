// Mail — a compose window that hands the message to the visitor's mail client (mailto:).
import { registerApp } from './registry.js';
import { ICON, I } from './icons.js';
import { esc, LIGHTS } from './shared.js';

const template = (C) => `
    <header class="tb" data-drag>${LIGHTS}<b class="tt c">New Message</b><i class="ic send" data-send title="Send">${I.send}</i></header>
    <form class="compose">
      <label class="rw"><span>To:</span><input value="${esc(C.name)} &lt;${esc(C.contact.email)}&gt;" readonly /></label>
      <label class="rw"><span>Cc:</span><input /></label>
      <label class="rw"><span>Subject:</span><input name="subject" /></label>
      <label class="rw"><span>From:</span><input name="from" type="email" placeholder="your@email.com" /></label>
      <textarea name="msg" placeholder="Write your message…"></textarea>
    </form>`;

registerApp({
  id: 'mail',
  name: 'Mail',
  icon: ICON.mail,
  size: { w: 540, h: 430, minW: 400, minH: 320 },
  pos: { x: 210, y: 48 },
  dock: true,
  titlebar: 'none',
  aliases: [{ name: 'contact' }],
  mount(el, ctx) {
    const C = ctx.content;
    el.innerHTML = template(C);
    el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-send]')) return;
      const d = new FormData(el.querySelector('form'));
      ctx.sound.pop();
      const subject = encodeURIComponent(d.get('subject') || 'Hello from your portfolio');
      const body = encodeURIComponent(`${d.get('msg') || ''}\n\n${d.get('from') ? `— ${d.get('from')}` : ''}`);
      window.location.href = `mailto:${C.contact.email}?subject=${subject}&body=${body}`;
    });
  },
});
