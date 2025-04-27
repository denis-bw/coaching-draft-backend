import { v2 as cloudinary } from 'cloudinary';
import { db } from '../firebaseAdminConfig.js';
import teamSchema from '../models/team.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const createTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        message: "Помилка авторизації", 
        error: "Користувач не авторизований" 
      });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        message: "Порожній запит", 
        error: "Немає даних для створення команди" 
      });
    }

    const data = req.body;

    if (data.athleteIds && typeof data.athleteIds === 'string') {
      try {
        data.athleteIds = JSON.parse(data.athleteIds);
      } catch (e) {
        console.error("Не вдалося розпарсити athleteIds:", e);
      }
    }

    const { error, value } = teamSchema.validate(data, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: 'Помилка валідації', details: error.details });
    }

    const teamRef = db.collection('teams').doc();
    const teamId = teamRef.id;

    const teamData = {
      ...value,
      userId,
      createdAt: new Date().toISOString(),
    };

    if (req.file && req.file.buffer) {
      const uniqueId = `team_${userId}_${Date.now()}`;
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'teams',
            public_id: uniqueId,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      teamData.logo = uploadResult.secure_url;
    } else {
      teamData.logo = null;
    }

    await teamRef.set(teamData);

    return res.status(201).json({
      message: "Команда створена успішно",
      team: {
        id: teamId,
        ...teamData,
      },
    });
  } catch (err) {
    console.error("Помилка при створенні команди:", err);
    return res.status(500).json({ message: "Помилка сервера при створенні команди", error: err.message });
  }
};

export const getTeams = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        message: "Помилка авторизації",
        error: "Користувач не авторизований"
      });
    }
    
    const { page = 1, name } = req.query; 
    const pageSize = 5; 
    
    const offset = (page - 1) * pageSize;
    
    let query = db.collection('teams')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');
    
    if (name) {
      const allTeamsSnapshot = await db.collection('teams')
        .where('userId', '==', userId)
        .get();
        
      const filteredTeams = [];
      allTeamsSnapshot.forEach(doc => {
        const teamData = doc.data();
        if (teamData.name.toLowerCase().includes(name.toLowerCase())) {
          filteredTeams.push({
            id: doc.id,
            name: teamData.name,
            logo: teamData.logo || null,
            createdAt: teamData.createdAt
          });
        }
      });
      
      filteredTeams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      const paginatedTeams = filteredTeams.slice(offset, offset + pageSize);
      
      if (paginatedTeams.length === 0) {
        return res.status(404).json({ message: 'Команди не знайдені' });
      }
      
      return res.status(200).json({
        message: 'Команди отримані успішно',
        teams: paginatedTeams.map(team => ({
          id: team.id,
          name: team.name,
          logo: team.logo
        })),
      });
    } else {
   
      const teamsSnapshot = await query
        .limit(pageSize)
        .offset(offset)
        .get();
      
      if (teamsSnapshot.empty) {
        return res.status(404).json({ message: 'Команди не знайдені' });
      }
      
      const teams = teamsSnapshot.docs.map(doc => {
        const teamData = doc.data();
        return {
          id: doc.id,
          name: teamData.name,
          logo: teamData.logo || null,
        };
      });
      
      return res.status(200).json({
        message: 'Команди отримані успішно',
        teams,
      });
    }
  } catch (err) {
    console.error("Помилка при отриманні команд:", err);
    return res.status(500).json({ message: "Помилка сервера при отриманні команд", error: err.message });
  }
};

export const getTeamById = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        message: "Помилка авторизації",
        error: "Користувач не авторизований"
      });
    }

    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка отримання даних",
        error: "ID команди не вказано"
      });
    }

    const teamDoc = await db.collection('teams').doc(teamId).get();

    if (!teamDoc.exists) {
      return res.status(404).json({
        message: "Команду не знайдено",
        error: "Команда з вказаним ID не існує"
      });
    }

    const teamData = teamDoc.data();
    
    if (teamData.userId !== userId) {
      return res.status(403).json({
        message: "Відмовлено в доступі",
        error: "У вас немає прав доступу до цієї команди"
      });
    }

    const athletes = [];
    if (teamData.athletes && teamData.athletes.length > 0) {
      for (const athleteId of teamData.athletes) {
        const athleteDoc = await db.collection('athletes').doc(athleteId).get();
        if (athleteDoc.exists) {
          const athleteData = athleteDoc.data();
          if (athleteData.userId === userId) {
            athletes.push({
              id: athleteDoc.id,
              firstName: athleteData.firstName,
              lastName: athleteData.lastName,
              middleName: athleteData.middleName || null,
              photo: athleteData.photo || null
            });
          }
        }
      }
    }

    const fullTeamInfo = {
      id: teamId,
      ...teamData,
      athletes
    };

    return res.status(200).json({
      message: "Інформацію про команду отримано успішно",
      team: fullTeamInfo
    });

  } catch (err) {
    console.error("Помилка при отриманні інформації про команду:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при отриманні інформації про команду", 
      error: err.message 
    });
  }
};