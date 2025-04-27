import { v2 as cloudinary } from 'cloudinary';
import { db, admin } from '../firebaseAdminConfig.js';
import athleteSchema from '../models/athlete.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const PAGE_SIZE = 8;

export const createAthlete = async (req, res) => {
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
        message: "Помилка отримання даних", 
        error: "Запит порожній або не містить даних" 
      });
    }

    const data = req.body;

    if (data.previousEstablishments) {
      try {
        data.previousEstablishments = JSON.parse(data.previousEstablishments);
      } catch (e) {
        console.error("Error parsing previousEstablishments:", e);
      }
    }

    if (data.medicalInformation) {
      try {
        data.medicalInformation = JSON.parse(data.medicalInformation);
      } catch (e) {
        console.error("Error parsing medicalInformation:", e);
      }
    }

    if (data.parentsInformation) {
      try {
        data.parentsInformation = JSON.parse(data.parentsInformation);
      } catch (e) {
        console.error("Error parsing parentsInformation:", e);
      }
    }

    const { error, value } = athleteSchema.validate(data, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: 'Помилка валідації', details: error.details });
    }

    const athleteRef = db.collection('athletes').doc();
    const athleteId = athleteRef.id;

    const athleteData = {
      ...value,
      userId,
      createdAt: new Date().toISOString(),
    };

   
    if (req.file && req.file.buffer) {
      const uniqueId = `athlete_${userId}_${Date.now()}`;
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'athletes',
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
      
      athleteData.photo = uploadResult.secure_url;
    } else {
      athleteData.photo = null;
    }

    if (data.teamId) {
      const teamRef = db.collection('teams').doc(data.teamId);
      const teamDoc = await teamRef.get();

      if (!teamDoc.exists) {
        return res.status(400).json({ message: 'Команда з таким ID не знайдена' });
      }
      
      const teamData = teamDoc.data();
      if (teamData.userId !== userId) {
        return res.status(403).json({ 
          message: 'Відмовлено в доступі', 
          error: 'Ви не можете додати спортсмена до команди, яка вам не належить' 
        });
      }

      await teamRef.update({
        athletes: admin.firestore.FieldValue.arrayUnion(athleteId),
      });

      athleteData.teamId = data.teamId;
    } else {
      athleteData.teamId = null;
    }

    await athleteRef.set(athleteData);

    if (value.previousCoaches && Array.isArray(value.previousCoaches) && value.previousCoaches.length > 0) {
      const batch = db.batch();
      value.previousCoaches.forEach((coach) => {
        const coachRef = db.collection('previousCoaches').doc();
        batch.set(coachRef, { ...coach, athleteId, userId });
      });
      await batch.commit();
    }

    if (value.medicalExaminations && Array.isArray(value.medicalExaminations) && value.medicalExaminations.length > 0) {
      const batch = db.batch();
      value.medicalExaminations.forEach((exam) => {
        const examRef = db.collection('medicalExaminations').doc();
        batch.set(examRef, { ...exam, athleteId, userId });
      });
      await batch.commit();
    }

    if (value.relatives && Array.isArray(value.relatives) && value.relatives.length > 0) {
      const batch = db.batch();
      value.relatives.forEach((relative) => {
        const relRef = db.collection('relatives').doc();
        batch.set(relRef, { ...relative, athleteId, userId });
      });
      await batch.commit();
    }

    return res.status(201).json({
      message: "Спортсмен створений успішно",
      athlete: {
        id: athleteId,
        ...athleteData,
      },
    });

  } catch (err) {
    console.error("Помилка при створенні спортсмена:", err);
    return res.status(500).json({ message: "Помилка сервера при створенні спортсмена", error: err.message });
  }
};

export const getAthleteById = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        message: "Помилка авторизації",
        error: "Користувач не авторизований"
      });
    }

    const { athleteId } = req.params;

    if (!athleteId) {
      return res.status(400).json({
        message: "Помилка отримання даних",
        error: "ID спортсмена не вказано"
      });
    }

    const athleteDoc = await db.collection('athletes').doc(athleteId).get();

    if (!athleteDoc.exists) {
      return res.status(404).json({
        message: "Спортсмена не знайдено",
        error: "Спортсмен з вказаним ID не існує"
      });
    }

    const athleteData = athleteDoc.data();
    
    if (athleteData.userId !== userId) {
      return res.status(403).json({
        message: "Відмовлено в доступі",
        error: "У вас немає прав доступу до цього спортсмена"
      });
    }

    const previousCoachesSnapshot = await db.collection('previousCoaches')
      .where('athleteId', '==', athleteId)
      .where('userId', '==', userId)
      .get();
    
    const previousCoaches = [];
    previousCoachesSnapshot.forEach(doc => {
      previousCoaches.push({ id: doc.id, ...doc.data() });
    });

    const medicalExaminationsSnapshot = await db.collection('medicalExaminations')
      .where('athleteId', '==', athleteId)
      .where('userId', '==', userId)
      .get();
    
    const medicalExaminations = [];
    medicalExaminationsSnapshot.forEach(doc => {
      medicalExaminations.push({ id: doc.id, ...doc.data() });
    });

    const relativesSnapshot = await db.collection('relatives')
      .where('athleteId', '==', athleteId)
      .where('userId', '==', userId)
      .get();
    
    const relatives = [];
    relativesSnapshot.forEach(doc => {
      relatives.push({ id: doc.id, ...doc.data() });
    });

    const fullAthleteInfo = {
      id: athleteId,
      ...athleteData,
      previousCoaches: previousCoaches.length > 0 ? previousCoaches : athleteData.previousCoaches || [],
      medicalExaminations: medicalExaminations.length > 0 ? medicalExaminations : athleteData.medicalExaminations || [],
      relatives: relatives.length > 0 ? relatives : athleteData.relatives || []
    };

    return res.status(200).json({
      message: "Інформацію про спортсмена отримано успішно",
      athlete: fullAthleteInfo
    });

  } catch (err) {
    console.error("Помилка при отриманні інформації про спортсмена:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при отриманні інформації про спортсмена", 
      error: err.message 
    });
  }
};

export async function searchAthletes(req, res) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        message: "Помилка авторизації",
        error: "Користувач не авторизований"
      });
    }

    const { query = "all", teamId = null, page = 1, filter = 'all' } = req.query;
    const offset = (page - 1) * PAGE_SIZE;
  
    let query_db = db.collection('athletes').where('userId', '==', userId);

    if (teamId) {

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
      
      query_db = query_db.where('teamId', '==', teamId);
    } 
    else if (filter === 'withTeam') {
      // В Firestore не можна використовувати != null, тому фільтруємо на рівні коду
      // Якщо є багато атлетів, це може бути неефективно. Краще зберігати в атлетів поле hasTeam: true/false
      // Доробити завтра
    }
    else if (filter === 'withoutTeam' || query === 'no-team') {
      query_db = query_db.where('teamId', '==', null);
    }
    
    if (query !== "all" && query !== 'no-team') {
      query_db = query_db.where('searchKeywords', 'array-contains', query.toLowerCase());
    }
    
    const athletesSnapshot = await query_db
      .orderBy('lastName')
      .offset(offset)
      .limit(PAGE_SIZE)
      .get();
    
    const teamIds = new Set();
    athletesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.teamId) {
        teamIds.add(data.teamId);
      }
    });
    
    const teamsData = {};
    if (teamIds.size > 0) {
      const teamsArray = Array.from(teamIds);
      for (const teamId of teamsArray) {
        const teamDoc = await db.collection('teams').doc(teamId).get();
        if (teamDoc.exists) {
          teamsData[teamId] = teamDoc.data().name || '';
        }
      }
    }
    
    let athletes = athletesSnapshot.docs.map(doc => {
      const data = doc.data();
      const teamName = data.teamId ? teamsData[data.teamId] || null : null;
      
      return {
        id: doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        patronymic: data.middleName || null, 
        photo: data.photo || null,
        teamId: data.teamId || null,
        teamName: teamName
      };
    });
    
    if (filter === 'withTeam' && !teamId) {
      athletes = athletes.filter(athlete => athlete.teamId !== null);
    }
    // console.log(athletes)
    return res.json({ athletes });
  } catch (err) {
    console.error("Помилка при пошуку спортсменів:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при пошуку спортсменів", 
      error: err.message 
    });
  }
}