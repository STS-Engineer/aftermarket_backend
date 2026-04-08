require('dotenv').config();
const { Client } = require('pg');
const UserAuth   = require('../models/UserAuth');

// ── Config de connexion DB2 ───────────────────────────────
const getClientConfig = () => ({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB2_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    require:            true,  
    rejectUnauthorized: false, 
  },
});

async function createUserAuth(member) {
  try {
    const existing = await UserAuth.findOne({
      where: { member_id: member.id }
    });

    if (existing) {
      console.warn(`⚠️  UserAuth déjà existant pour member_id ${member.id}`);
      return;
    }

    const rawPassword = `${member.first_name}@2026`;

    await UserAuth.create({
      member_id: member.id,
      email:     member.email,
      password:  rawPassword,
      role:      'user',
    });
  } catch (err) {
    console.error(`❌ Erreur création UserAuth :`, err.message);
  }
}

async function startMemberListener() {
  const client = new Client(getClientConfig());

  try {
    const config = getClientConfig();
    console.log(`🔗 Connexion à ${config.host}:${config.port}/${config.database}...`);

    await client.connect();
    await client.query('LISTEN new_company_member');

    console.log('👂 Listener actif sur avocarbon_directory > company_members');

    client.on('notification', async (msg) => {
      try {
        const member = JSON.parse(msg.payload);
        await createUserAuth(member);
      } catch (err) {
        console.error('❌ Erreur parsing notification :', err.message);
      }
    });

    client.on('error', async (err) => {
      console.error('❌ Erreur listener :', err.message);
      await client.end().catch(() => {});
      console.log('🔄 Reconnexion dans 5s...');
      setTimeout(startMemberListener, 5000);
    });

  } catch (err) {
    console.error('❌ Impossible de démarrer le listener :', err.message);
    await client.end().catch(() => {});
    console.log('🔄 Nouvelle tentative dans 5s...');
    setTimeout(startMemberListener, 5000);
  }
}

module.exports = { startMemberListener };
