
import { Subject, Staff, TimeSlot, TimetableSettings } from "../types/timetable";

export const generateTimetable = (
  subjects: Subject[],
  staff: Staff[],
  settings: TimetableSettings
): TimeSlot[] => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const periodsPerDay = settings.periodTimings.length;
  let timetable: TimeSlot[] = [];

  console.log("Starting timetable generation with:", { 
    subjects: subjects.length, 
    staff: staff.length, 
    days, 
    periodsPerDay 
  });

  // Create empty timetable structure
  days.forEach((day) => {
    for (let period = 1; period <= periodsPerDay; period++) {
      // Add regular periods
      timetable.push({
        day,
        period,
        subjectId: null,
        staffId: null,
      });
    }
  });

  // Add breaks to the timetable
  days.forEach((day) => {
    settings.breaks.forEach((breakInfo) => {
      timetable.push({
        day,
        period: breakInfo.after + 0.5, // Position breaks between periods
        subjectId: null,
        staffId: null,
        isBreak: true,
        breakName: breakInfo.name,
      });
    });
  });

  // Sort subjects by priority (labs first, then regular subjects)
  const sortedSubjects = [...subjects].sort((a, b) => {
    // Labs have higher priority
    if (a.isLab && !b.isLab) return -1;
    if (!a.isLab && b.isLab) return 1;
    // Then sort by custom priority value
    return a.priority - b.priority;
  });

  // Schedule lab sessions first (they take 2 consecutive periods)
  const labSubjects = sortedSubjects.filter((subject) => subject.isLab);
  
  labSubjects.forEach((lab) => {
    // Each lab should only be scheduled once (for 2 consecutive periods)
    // Instead of periodsPerWeek/2 which could lead to multiple sessions
    let scheduled = false;
    const maxAttempts = 50; // Prevent infinite loops
    let attempts = 0;
    
    // Try to place lab in a single 2-period block
    while (!scheduled && attempts < maxAttempts) {
      attempts++;
      
      // Randomly select a day
      const randomDayIndex = Math.floor(Math.random() * days.length);
      const day = days[randomDayIndex];
      
      // Find potential start periods that allow for 2 consecutive slots
      // Avoid periods before breaks
      const potentialStartPeriods = [];
      for (let p = 1; p <= periodsPerDay - 1; p++) {
        // Check if this period and next period are not before a break
        const isBeforeBreak = settings.breaks.some(b => b.after === p);
        if (!isBeforeBreak) {
          potentialStartPeriods.push(p);
        }
      }
      
      if (potentialStartPeriods.length === 0) continue;
      
      const randomStartPeriodIndex = Math.floor(Math.random() * potentialStartPeriods.length);
      const startPeriod = potentialStartPeriods[randomStartPeriodIndex];
      
      // Find the slots for these periods
      const firstPeriodSlot = timetable.find(
        slot => slot.day === day && slot.period === startPeriod && !slot.isBreak
      );
      const secondPeriodSlot = timetable.find(
        slot => slot.day === day && slot.period === startPeriod + 1 && !slot.isBreak
      );
      
      // Check if both slots are available and staff isn't already assigned elsewhere
      if (
        firstPeriodSlot && 
        secondPeriodSlot && 
        !firstPeriodSlot.subjectId && 
        !secondPeriodSlot.subjectId
      ) {
        // Check if staff is already teaching in another class at this time
        const staffBusyFirst = timetable.some(
          slot => 
            slot.day === day && 
            slot.period === startPeriod && 
            slot.staffId === lab.staffId &&
            slot !== firstPeriodSlot
        );
        
        const staffBusySecond = timetable.some(
          slot => 
            slot.day === day && 
            slot.period === startPeriod + 1 && 
            slot.staffId === lab.staffId &&
            slot !== secondPeriodSlot
        );
        
        if (!staffBusyFirst && !staffBusySecond) {
          // Assign lab to both periods
          firstPeriodSlot.subjectId = lab.id;
          firstPeriodSlot.staffId = lab.staffId;
          firstPeriodSlot.spanTwoPeriods = true;
          
          secondPeriodSlot.subjectId = lab.id;
          secondPeriodSlot.staffId = lab.staffId;
          secondPeriodSlot.spanTwoPeriods = true;
          
          scheduled = true;
          console.log(`Scheduled lab ${lab.name} on ${day} at period ${startPeriod}-${startPeriod+1}`);
        }
      }
    }
    
    // If we couldn't schedule the lab normally, force place it
    if (!scheduled) {
      console.log(`Could not schedule lab ${lab.name} normally, forcing placement`);
      // Find any two consecutive available slots
      for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const day = days[dayIndex];
        for (let period = 1; period < periodsPerDay; period++) {
          // Skip periods before breaks
          const isBeforeBreak = settings.breaks.some(b => b.after === period);
          if (isBeforeBreak) continue;
          
          const firstSlot = timetable.find(
            slot => slot.day === day && slot.period === period && !slot.isBreak && !slot.subjectId
          );
          const secondSlot = timetable.find(
            slot => slot.day === day && slot.period === period + 1 && !slot.isBreak && !slot.subjectId
          );
          
          if (firstSlot && secondSlot) {
            firstSlot.subjectId = lab.id;
            firstSlot.staffId = lab.staffId;
            firstSlot.spanTwoPeriods = true;
            
            secondSlot.subjectId = lab.id;
            secondSlot.staffId = lab.staffId;
            secondSlot.spanTwoPeriods = true;
            
            scheduled = true;
            console.log(`Force scheduled lab ${lab.name} on ${day} at period ${period}-${period+1}`);
            break;
          }
        }
        if (scheduled) break;
      }
    }
  });

  // Distribute regular subjects
  const regularSubjects = sortedSubjects.filter(subject => !subject.isLab);
  
  regularSubjects.forEach(subject => {
    let periodsAssigned = 0;
    let failedAttempts = 0;
    
    while (periodsAssigned < subject.periodsPerWeek && failedAttempts < 50) {
      // Pick a random day and period
      const randomDayIndex = Math.floor(Math.random() * days.length);
      const day = days[randomDayIndex];
      const randomPeriodIndex = Math.floor(Math.random() * periodsPerDay) + 1;
      
      // Find the slot for this period
      const timeSlot = timetable.find(
        slot => slot.day === day && slot.period === randomPeriodIndex && !slot.isBreak
      );
      
      // Check if slot is available
      if (timeSlot && !timeSlot.subjectId) {
        // Check if staff is already teaching in another class at this time
        const staffBusy = timetable.some(
          slot => 
            slot.day === day && 
            slot.period === randomPeriodIndex && 
            slot.staffId === subject.staffId &&
            slot !== timeSlot
        );
        
        if (!staffBusy) {
          // Assign subject to this period
          timeSlot.subjectId = subject.id;
          timeSlot.staffId = subject.staffId;
          periodsAssigned++;
        } else {
          failedAttempts++;
        }
      } else {
        failedAttempts++;
      }
    }
    
    // If we couldn't assign all periods normally, force assign the remaining ones
    if (periodsAssigned < subject.periodsPerWeek) {
      // Sort the timetable slots to ensure a deterministic order
      const availableSlots = timetable
        .filter(slot => !slot.isBreak && !slot.subjectId)
        .sort((a, b) => {
          // Sort by day first
          const dayOrder = days.indexOf(a.day) - days.indexOf(b.day);
          if (dayOrder !== 0) return dayOrder;
          // Then by period
          return a.period - b.period;
        });
      
      for (let i = 0; i < availableSlots.length && periodsAssigned < subject.periodsPerWeek; i++) {
        const slot = availableSlots[i];
        
        // Assign subject even if staff is busy elsewhere
        slot.subjectId = subject.id;
        slot.staffId = subject.staffId;
        periodsAssigned++;
      }
    }
    
    console.log(`Assigned ${periodsAssigned}/${subject.periodsPerWeek} periods for ${subject.name}`);
  });

  // Sort the timetable by day and period for display
  timetable.sort((a, b) => {
    const dayOrder = days.indexOf(a.day) - days.indexOf(b.day);
    if (dayOrder !== 0) return dayOrder;
    return a.period - b.period;
  });

  return timetable;
};
