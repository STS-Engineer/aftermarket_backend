// config/syncAllUserAuth.js
require('dotenv').config();
const bcrypt          = require('bcryptjs');
const sequelize       = require('./sequelize');
const sequelizeSecond = require('./sequelizeSecond');
const UserAuth        = require('../models/UserAuth');
const CompanyMember   = require('../models/User');

async function syncAllUserAuth() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connecté à AVOCarbonDB_Form (DB1)');

    await sequelizeSecond.authenticate();
    console.log('✅ Connecté à avocarbon_directory (DB2)');

    // ── Créer la table user_auth si elle n'existe pas ─────
    await UserAuth.sync({ force: false });
    console.log('✅ Table user_auth prête\n');

    const members = await CompanyMember.findAll();
    console.log(`📋 ${members.length} membres trouvés dans company_members\n`);

    let created = 0;
    let skipped = 0;
    let errors  = 0;

    for (const member of members) {
      try {
        const existing = await UserAuth.findOne({
          where: { member_id: member.id }
        });

        if (existing) {
          console.log(`⏭️  Ignoré   : ${member.email} (UserAuth déjà existant)`);
          skipped++;
          continue;
        }

        const firstName   = member.first_name || member.display_name || 'user';
        const rawPassword = `${firstName}@2026`;
        const hashed      = await bcrypt.hash(rawPassword, 10);

        await UserAuth.create({
          member_id: member.id,
          email:     member.email,
          password:  hashed,
        });

        console.log(`✅ Créé     : ${member.email} | password: ${rawPassword}`);
        created++;

      } catch (err) {
        console.error(`❌ Erreur   : ${member.email} → ${err.message}`);
        errors++;
      }
    }

    console.log('\n─────────────────────────────────────────────');
    console.log(`📊 Résumé :`);
    console.log(`   ✅ Créés   : ${created}`);
    console.log(`   ⏭️  Ignorés : ${skipped}`);
    console.log(`   ❌ Erreurs : ${errors}`);
    console.log(`   📋 Total   : ${members.length}`);
    console.log('─────────────────────────────────────────────\n');

    process.exit(0);

  } catch (err) {
    console.error('❌ Erreur fatale :', err.message);
    process.exit(1);
  }
}

syncAllUserAuth();