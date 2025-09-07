import { v2 as cloudinary } from 'cloudinary';
import { db } from '../firebaseAdminConfig.js';
import teamSchema from '../models/team.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Константи
const STORAGE_LIMIT_BYTES =  500 * 1024 * 1024; 

// Допоміжна функція для підрахунку використаного сховища користувача
const getUserStorageUsage = async (userId) => {
  try {
    // Отримуємо всі команди користувача
    const userTeamsSnapshot = await db.collection('teams')
      .where('userId', '==', userId)
      .get();

    let totalStorageUsed = 0;

    // Для кожної команди рахуємо розмір всіх фото в галереї
    for (const teamDoc of userTeamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const galleryPhotos = teamData.gallery || [];
      
      // Рахуємо розмір всіх фото в галереї команди
      for (const photo of galleryPhotos) {
        if (photo.size) {
          totalStorageUsed += photo.size;
        }
      }
    }

    return totalStorageUsed;
  } catch (error) {
    console.error("Помилка при підрахунку використаного сховища:", error);
    throw error;
  }
};

// Допоміжна функція для розрахунку відсотка використання
const calculateStoragePercentage = (usedBytes) => {
  return Math.round((usedBytes / STORAGE_LIMIT_BYTES) * 100);
};

export const createTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
   
    const { name, ageCategory, athleteIds = [] } = req.body;
    
    const { error, value } = teamSchema.validate({
      name,
      ageCategory,
      athleteIds
    }, { abortEarly: false });

    if (error) {
      return res.status(400).json({ 
        message: 'Помилка валідації', 
        details: error.details 
      });
    }

    const teamRef = db.collection('teams').doc();
    const teamId = teamRef.id;

    const teamData = {
      name: value.name,
      ageCategory: value.ageCategory,
      userId,
      athleteIds: value.athleteIds,
      createdAt: new Date().toISOString(),
      logo: null,
      gallery: [], // Ініціалізуємо порожню галерею
      galleryCount: 0 // Лічильник фото в галереї
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
    }

    if (value.athleteIds && value.athleteIds.length > 0) {
      const batch = db.batch();
      const invalidAthletes = [];
      const athleteRefs = [];

      for (const athleteId of value.athleteIds) {
        const athleteRef = db.collection('athletes').doc(athleteId);
        athleteRefs.push({ ref: athleteRef, id: athleteId });
        
        const athleteDoc = await athleteRef.get();
        
        if (!athleteDoc.exists) {
          invalidAthletes.push({ 
            id: athleteId, 
            error: "Спортсмен не існує" 
          });
          continue;
        }
        
        const athleteData = athleteDoc.data();
        
        if (athleteData.userId !== userId) {
          invalidAthletes.push({ 
            id: athleteId, 
            error: "Немає доступу до цього спортсмена" 
          });
          continue;
        }
        
        if (athleteData.teamId?.trim?.()) {
          invalidAthletes.push({
            id: athleteId, 
            error: "Спортсмен вже в іншій команді"
          });
          continue;
        }
      }

      if (invalidAthletes.length > 0) {
        return res.status(400).json({
          message: "Помилка при додаванні спортсменів до команди",
          invalidAthletes
        });
      }

      for (const { ref } of athleteRefs) {
        batch.update(ref, { 
          teamId,
          updatedAt: new Date().toISOString() 
        });
      }

      batch.set(teamRef, teamData);

      await batch.commit();
    } else {
      await teamRef.set(teamData);
    }

    return res.status(201).json({
      message: "Команда створена успішно",
      team: {
        id: teamId,
        ...teamData,
      },
    });
  } catch (err) {
    console.error("Помилка при створенні команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при створенні команди", 
      error: err.message 
    });
  }
};

export const getTeams = async (req, res) => {
  try {
    const userId = req.user?.id;
    
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
            createdAt: teamData.createdAt,
            galleryCount: teamData.galleryCount || 0
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
          logo: team.logo,
          galleryCount: team.galleryCount
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
          galleryCount: teamData.galleryCount || 0
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
    const athleteIds = teamData.athleteIds || teamData.athletes || [];
    
    if (athleteIds.length > 0) {
      for (const athleteId of athleteIds) {
        const athleteDoc = await db.collection('athletes').doc(athleteId).get();
        if (athleteDoc.exists) {
          const athleteData = athleteDoc.data();
          if (athleteData.userId === userId) {
            athletes.push({
              id: athleteDoc.id,
              firstName: athleteData.firstName,
              lastName: athleteData.lastName,
              middleName: athleteData.middleName || athleteData.patronymic || null,
              photo: athleteData.photo || null
            });
          }
        }
      }
    }

    // Отримуємо тільки останнє фото для основної сторінки
    const gallery = teamData.gallery || [];
    const lastPhoto = gallery.length > 0 ? gallery[0] : null;

    // Отримуємо інформацію про сховище
    const totalStorageUsed = await getUserStorageUsage(userId);
    const storagePercentage = calculateStoragePercentage(totalStorageUsed);

    const fullTeamInfo = {
      id: teamId,
      name: teamData.name,
      ageCategory: teamData.ageCategory,
      logo: teamData.logo || null,
      userId: teamData.userId,
      athleteIds: athleteIds,
      createdAt: teamData.createdAt,
      updatedAt: teamData.updatedAt,
      galleryCount: teamData.galleryCount || 0,
      lastPhoto: lastPhoto,
      storageInfo: {
        usedBytes: totalStorageUsed,
        limitBytes: STORAGE_LIMIT_BYTES,
        usedPercentage: storagePercentage,
        remainingBytes: STORAGE_LIMIT_BYTES - totalStorageUsed
      },
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

// Решта функцій залишається без змін...
export const updateTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;
    const { name, ageCategory } = req.body;
    
    const shouldUpdateAthletes = 'athleteIds' in req.body;
    const athleteIds = shouldUpdateAthletes ? (req.body.athleteIds || []) : null;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка оновлення",
        error: "ID команди не вказано"
      });
    }

    const validationData = { name, ageCategory };
    if (shouldUpdateAthletes) {
      validationData.athleteIds = athleteIds;
    }

    const { error, value } = teamSchema.validate(validationData, { abortEarly: false });

    if (error) {
      return res.status(400).json({ 
        message: 'Помилка валідації', 
        details: error.details 
      });
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

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

    const updatedTeamData = {
      name: value.name,
      ageCategory: value.ageCategory,
      updatedAt: new Date().toISOString()
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
      
      updatedTeamData.logo = uploadResult.secure_url;
    }

    const batch = db.batch();

    if (shouldUpdateAthletes) {
      const oldAthleteIds = teamData.athleteIds || [];
      const newAthleteIds = value.athleteIds || [];

      const invalidAthletes = [];
      
      for (const athleteId of newAthleteIds) {
        const athleteRef = db.collection('athletes').doc(athleteId);
        const athleteDoc = await athleteRef.get();
        
        if (!athleteDoc.exists) {
          invalidAthletes.push({ 
            id: athleteId, 
            error: "Спортсмен не існує" 
          });
          continue;
        }
        
        const athleteData = athleteDoc.data();
        
        if (athleteData.userId !== userId) {
          invalidAthletes.push({ 
            id: athleteId, 
            error: "Немає доступу до цього спортсмена" 
          });
          continue;
        }
        
        if (athleteData.teamId && athleteData.teamId !== teamId && athleteData.teamId.trim()) {
          invalidAthletes.push({
            id: athleteId, 
            error: "Спортсмен вже в іншій команді"
          });
          continue;
        }
      }

      if (invalidAthletes.length > 0) {
        return res.status(400).json({
          message: "Помилка при оновленні спортсменів команди",
          invalidAthletes
        });
      }

      const athletesToRemove = oldAthleteIds.filter(id => !newAthleteIds.includes(id));
      for (const athleteId of athletesToRemove) {
        const athleteRef = db.collection('athletes').doc(athleteId);
        batch.update(athleteRef, { 
          teamId: '',
          updatedAt: new Date().toISOString() 
        });
      }

      const athletesToAdd = newAthleteIds.filter(id => !oldAthleteIds.includes(id));
      for (const athleteId of athletesToAdd) {
        const athleteRef = db.collection('athletes').doc(athleteId);
        batch.update(athleteRef, { 
          teamId,
          updatedAt: new Date().toISOString() 
        });
      }

      updatedTeamData.athleteIds = newAthleteIds;
    }

    batch.update(teamRef, updatedTeamData);
    
    await batch.commit();

    return res.status(200).json({
      message: "Команду оновлено успішно",
      team: {
        id: teamId,
        ...teamData,
        ...updatedTeamData,
      },
    });

  } catch (err) {
    console.error("Помилка при оновленні команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при оновленні команди", 
      error: err.message 
    });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка видалення",
        error: "ID команди не вказано"
      });
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

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

    const batch = db.batch();

    // Видаляємо зв'язки спортсменів з командою
    const athleteIds = teamData.athleteIds || [];
    
    for (const athleteId of athleteIds) {
      const athleteRef = db.collection('athletes').doc(athleteId);
      const athleteDoc = await athleteRef.get();
      
      if (athleteDoc.exists) {
        const athleteData = athleteDoc.data();
        if (athleteData.userId === userId && athleteData.teamId === teamId) {
          batch.update(athleteRef, { 
            teamId: '',
            updatedAt: new Date().toISOString() 
          });
        }
      }
    }

    // Видаляємо всі фото з галереї з Cloudinary
    const galleryPhotos = teamData.gallery || [];
    for (const photo of galleryPhotos) {
      try {
        if (photo.publicId) {
          await cloudinary.uploader.destroy(photo.publicId);
        }
      } catch (cloudinaryError) {
        console.error("Помилка при видаленні фото з Cloudinary:", cloudinaryError);
        // Продовжуємо навіть якщо не вдалося видалити з Cloudinary
      }
    }

    batch.delete(teamRef);

    await batch.commit();

    return res.status(200).json({
      message: "Команду видалено успішно",
      deletedTeamId: teamId
    });

  } catch (err) {
    console.error("Помилка при видаленні команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при видаленні команди", 
      error: err.message 
    });
  }
};

export const addAthletesToTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;
    const { athleteIds } = req.body;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка додавання",
        error: "ID команди не вказано"
      });
    }

    if (!athleteIds || !Array.isArray(athleteIds) || athleteIds.length === 0) {
      return res.status(400).json({
        message: "Помилка додавання",
        error: "Список спортсменів не вказано або порожній"
      });
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

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

    const invalidAthletes = [];
    const validAthleteIds = [];

    for (const athleteId of athleteIds) {
      const athleteRef = db.collection('athletes').doc(athleteId);
      const athleteDoc = await athleteRef.get();
      
      if (!athleteDoc.exists) {
        invalidAthletes.push({ 
          id: athleteId, 
          error: "Спортсмен не існує" 
        });
        continue;
      }
      
      const athleteData = athleteDoc.data();
      
      if (athleteData.userId !== userId) {
        invalidAthletes.push({ 
          id: athleteId, 
          error: "Немає доступу до цього спортсмена" 
        });
        continue;
      }
      
      if (athleteData.teamId && athleteData.teamId.trim() && athleteData.teamId !== teamId) {
        invalidAthletes.push({
          id: athleteId, 
          error: "Спортсмен вже в іншій команді"
        });
        continue;
      }

      if (athleteData.teamId === teamId) {
        continue;
      }

      validAthleteIds.push(athleteId);
    }

    if (invalidAthletes.length > 0) {
      return res.status(400).json({
        message: "Помилка при додаванні спортсменів до команди",
        invalidAthletes,
        validCount: validAthleteIds.length
      });
    }

    if (validAthleteIds.length === 0) {
      return res.status(200).json({
        message: "Всі спортсмени вже в команді",
        addedCount: 0
      });
    }

    const batch = db.batch();
    const currentAthleteIds = teamData.athleteIds || [];
    const updatedAthleteIds = [...new Set([...currentAthleteIds, ...validAthleteIds])];

    for (const athleteId of validAthleteIds) {
      const athleteRef = db.collection('athletes').doc(athleteId);
      batch.update(athleteRef, { 
        teamId,
        updatedAt: new Date().toISOString() 
      });
    }

    batch.update(teamRef, { 
      athleteIds: updatedAthleteIds,
      updatedAt: new Date().toISOString() 
    });

    await batch.commit();

    return res.status(200).json({
      message: "Спортсмени успішно додані до команди",
      addedCount: validAthleteIds.length,
      addedAthleteIds: validAthleteIds,
      totalAthletesInTeam: updatedAthleteIds.length
    });

  } catch (err) {
    console.error("Помилка при додаванні спортсменів до команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при додаванні спортсменів до команди", 
      error: err.message 
    });
  }
};

export const removeAthletesFromTeam = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;
    const { athleteIds } = req.body;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка видалення",
        error: "ID команди не вказано"
      });
    }

    if (!athleteIds || !Array.isArray(athleteIds) || athleteIds.length === 0) {
      return res.status(400).json({
        message: "Помилка видалення",
        error: "Список спортсменів не вказано або порожній"
      });
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

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

    const invalidAthletes = [];
    const validAthleteIds = [];
    const currentAthleteIds = teamData.athleteIds || [];

    for (const athleteId of athleteIds) {
      const athleteRef = db.collection('athletes').doc(athleteId);
      const athleteDoc = await athleteRef.get();
      
      if (!athleteDoc.exists) {
        invalidAthletes.push({ 
          id: athleteId, 
          error: "Спортсмен не існує" 
        });
        continue;
      }
      
      const athleteData = athleteDoc.data();
      
      if (athleteData.userId !== userId) {
        invalidAthletes.push({ 
          id: athleteId, 
          error: "Немає доступу до цього спортсмена" 
        });
        continue;
      }
      
      if (athleteData.teamId !== teamId) {
        invalidAthletes.push({
          id: athleteId, 
          error: "Спортсмен не в цій команді"
        });
        continue;
      }

      validAthleteIds.push(athleteId);
    }

    if (invalidAthletes.length > 0) {
      return res.status(400).json({
        message: "Помилка при видаленні спортсменів з команди",
        invalidAthletes,
        validCount: validAthleteIds.length
      });
    }

    if (validAthleteIds.length === 0) {
      return res.status(200).json({
        message: "Немає спортсменів для видалення з команди",
        removedCount: 0
      });
    }

    const batch = db.batch();
    const updatedAthleteIds = currentAthleteIds.filter(id => !validAthleteIds.includes(id));

    for (const athleteId of validAthleteIds) {
      const athleteRef = db.collection('athletes').doc(athleteId);
      batch.update(athleteRef, { 
        teamId: null, 
        updatedAt: new Date().toISOString() 
      });
    }

    batch.update(teamRef, { 
      athleteIds: updatedAthleteIds,
      updatedAt: new Date().toISOString() 
    });

    await batch.commit();

    return res.status(200).json({
      message: "Спортсмени успішно видалені з команди",
      removedCount: validAthleteIds.length,
      removedAthleteIds: validAthleteIds,
      totalAthletesInTeam: updatedAthleteIds.length
    });

  } catch (err) {
    console.error("Помилка при видаленні спортсменів з команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при видаленні спортсменів з команди", 
      error: err.message 
    });
  }
};

// ОНОВЛЕНІ функції галереї з пагінацією

// Оновлена функція getTeamGallery в teams-controller.js
export const getTeamGallery = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;
    const { page = 1 } = req.query;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка отримання галереї",
        error: "ID команди не вказано"
      });
    }

    const pageNum = parseInt(page);
    const pageSize = 30;
    const offset = (pageNum - 1) * pageSize;

    // Перевіряємо права доступу до команди
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

    // Отримуємо фото галереї з БД з пагінацією
    const galleryPhotos = teamData.gallery || [];
    const totalPhotos = galleryPhotos.length;
    const paginatedPhotos = galleryPhotos.slice(offset, offset + pageSize);
    const hasMore = offset + pageSize < totalPhotos;

    // Отримуємо інформацію про використання сховища
    const totalStorageUsed = await getUserStorageUsage(userId);
    const storagePercentage = calculateStoragePercentage(totalStorageUsed);

    return res.status(200).json({
      message: "Галерея команди отримана успішно",
      photos: paginatedPhotos.map(photo => ({
        id: photo.id,
        url: photo.url,
        uploadedAt: photo.uploadedAt,
        size: photo.size
      })),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalPhotos / pageSize),
        totalPhotos,
        hasMore,
        pageSize
      },
      storageInfo: {
        usedBytes: totalStorageUsed,
        limitBytes: STORAGE_LIMIT_BYTES,
        usedPercentage: storagePercentage,
        remainingBytes: STORAGE_LIMIT_BYTES - totalStorageUsed
      }
    });

  } catch (err) {
    console.error("Помилка при отриманні галереї команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при отриманні галереї команди", 
      error: err.message 
    });
  }
};

export const uploadTeamPhoto = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({
        message: "Помилка завантаження фото",
        error: "ID команди не вказано"
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: "Помилка завантаження фото",
        error: "Файл не надано"
      });
    }

    // Перевіряємо розмір файлу (5MB ліміт)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (req.file.buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({
        message: "Файл занадто великий",
        error: "Максимальний розмір файлу: 5MB"
      });
    }

    // Перевіряємо права доступу до команди
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

    // Перевіряємо ліміт сховища
    const currentStorageUsed = await getUserStorageUsage(userId);
    const fileSize = req.file.buffer.length;

    if (currentStorageUsed + fileSize > STORAGE_LIMIT_BYTES) {
      const remainingSpace = STORAGE_LIMIT_BYTES - currentStorageUsed;
      const remainingMB = Math.round(remainingSpace / (1024 * 1024));
      const fileSizeMB = Math.round(fileSize / (1024 * 1024));

      return res.status(413).json({
        message: "Перевищено ліміт сховища",
        error: `Недостатньо місця для завантаження. Залишилось: ${remainingMB}MB, потрібно: ${fileSizeMB}MB`,
        storageInfo: {
          usedBytes: currentStorageUsed,
          limitBytes: STORAGE_LIMIT_BYTES,
          usedPercentage: calculateStoragePercentage(currentStorageUsed),
          remainingBytes: remainingSpace
        }
      });
    }

    // Завантажуємо до Cloudinary в окрему папку для галереї
    const uniqueId = `team_gallery_${teamId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'team_galleries', // Окрема папка для галерей команд
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

    // Створюємо об'єкт фото для збереження в БД
    const newPhoto = {
      id: uniqueId,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      size: fileSize,
      uploadedAt: new Date().toISOString()
    };

    // Оновлюємо галерею в команді (додаємо на початок)
    const currentGallery = teamData.gallery || [];
    const updatedGallery = [newPhoto, ...currentGallery];
    const newGalleryCount = updatedGallery.length;

    await db.collection('teams').doc(teamId).update({
      gallery: updatedGallery,
      galleryCount: newGalleryCount,
      updatedAt: new Date().toISOString()
    });

    // Розраховуємо нову інформацію про сховище
    const newStorageUsed = currentStorageUsed + fileSize;
    const newStoragePercentage = calculateStoragePercentage(newStorageUsed);

    return res.status(201).json({
      message: "Фото успішно завантажено",
      photo: {
        id: newPhoto.id,
        url: newPhoto.url,
        uploadedAt: newPhoto.uploadedAt,
        size: newPhoto.size
      },
      storageInfo: {
        usedBytes: newStorageUsed,
        limitBytes: STORAGE_LIMIT_BYTES,
        usedPercentage: newStoragePercentage,
        remainingBytes: STORAGE_LIMIT_BYTES - newStorageUsed
      }
    });

  } catch (err) {
    console.error("Помилка при завантаженні фото команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при завантаженні фото команди", 
      error: err.message 
    });
  }
};

export const deleteTeamPhoto = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { teamId, photoId } = req.params;

    if (!teamId || !photoId) {
      return res.status(400).json({
        message: "Помилка видалення фото",
        error: "ID команди або фото не вказано"
      });
    }

    // Перевіряємо права доступу до команди
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

    // Знаходимо фото в галереї
    const currentGallery = teamData.gallery || [];
    const photoToDelete = currentGallery.find(photo => photo.id === photoId);

    if (!photoToDelete) {
      return res.status(404).json({
        message: "Фото не знайдено",
        error: "Фото з вказаним ID не існує в галереї команди"
      });
    }

    // Видаляємо з Cloudinary
    try {
      if (photoToDelete.publicId) {
        await cloudinary.uploader.destroy(photoToDelete.publicId);
      }
    } catch (cloudinaryError) {
      console.error("Помилка при видаленні з Cloudinary:", cloudinaryError);
      // Продовжуємо видалення з БД навіть якщо не вдалося видалити з Cloudinary
    }

    // Оновлюємо галерею в БД
    const updatedGallery = currentGallery.filter(photo => photo.id !== photoId);
    const newGalleryCount = updatedGallery.length;

    await db.collection('teams').doc(teamId).update({
      gallery: updatedGallery,
      galleryCount: newGalleryCount,
      updatedAt: new Date().toISOString()
    });

    // Розраховуємо нову інформацію про сховище
    const newStorageUsed = await getUserStorageUsage(userId);
    const newStoragePercentage = calculateStoragePercentage(newStorageUsed);

    return res.status(200).json({
      message: "Фото успішно видалено",
      deletedPhotoId: photoId,
      storageInfo: {
        usedBytes: newStorageUsed,
        limitBytes: STORAGE_LIMIT_BYTES,
        usedPercentage: newStoragePercentage,
        remainingBytes: STORAGE_LIMIT_BYTES - newStorageUsed
      }
    });

  } catch (err) {
    console.error("Помилка при видаленні фото команди:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при видаленні фото команди", 
      error: err.message 
    });
  }
};

// Додаткова функція для отримання інформації про сховище користувача
export const getUserStorageInfo = async (req, res) => {
  try {
    const userId = req.user?.id;

    const totalStorageUsed = await getUserStorageUsage(userId);
    const storagePercentage = calculateStoragePercentage(totalStorageUsed);

    return res.status(200).json({
      message: "Інформація про сховище отримана успішно",
      storageInfo: {
        usedBytes: totalStorageUsed,
        limitBytes: STORAGE_LIMIT_BYTES,
        usedPercentage: storagePercentage,
        remainingBytes: STORAGE_LIMIT_BYTES - totalStorageUsed,
        usedMB: Math.round(totalStorageUsed / (1024 * 1024)),
        limitMB: Math.round(STORAGE_LIMIT_BYTES / (1024 * 1024)),
        remainingMB: Math.round((STORAGE_LIMIT_BYTES - totalStorageUsed) / (1024 * 1024))
      }
    });

  } catch (err) {
    console.error("Помилка при отриманні інформації про сховище:", err);
    return res.status(500).json({ 
      message: "Помилка сервера при отриманні інформації про сховище", 
      error: err.message 
    });
  }
};