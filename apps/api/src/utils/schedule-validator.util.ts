export class ScheduleValidator {
  /**
   * Convert HH:mm:ss to total minutes from midnight
   */
  static parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Represents a shift interval within a 7-day continuous minute space.
   * Sunday 00:00 is 0. Saturday 23:59 is 10079.
   */
  static getShiftInterval(dayOfWeekIndex: number, startTime: string, endTime: string) {
    const startMin = dayOfWeekIndex * 24 * 60 + this.parseTime(startTime);
    let endMin = dayOfWeekIndex * 24 * 60 + this.parseTime(endTime);
    
    // crosses midnight
    if (this.parseTime(endTime) < this.parseTime(startTime)) {
      endMin += 24 * 60;
    }

    return { startMin, endMin };
  }

  static doIntervalsOverlap(a: { startMin: number, endMin: number }, b: { startMin: number, endMin: number }) {
    // Touching boundaries are allowed (a.endMin <= b.startMin || b.endMin <= a.startMin)
    // Strictly overlapping if: a.startMin < b.endMin && b.startMin < a.endMin
    return a.startMin < b.endMin && b.startMin < a.endMin;
  }

  static validateWeeklyShifts(
    days: {
      dayOfWeek: string;
      status: string;
      shifts: { startTime: string; endTime: string }[];
    }[],
    previousScheduleSundayOvernightShift?: { startTime: string; endTime: string } | null
  ) {
    const dayIndexMap: Record<string, number> = {
      SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6
    };

    const intervals: { startMin: number, endMin: number, source: string }[] = [];

    for (const day of days) {
      if (day.status !== 'WORKING') continue;
      const dayIdx = dayIndexMap[day.dayOfWeek];

      for (const shift of day.shifts) {
        const interval = this.getShiftInterval(dayIdx, shift.startTime, shift.endTime);
        
        // Handle wrap-around from Saturday overnight to Sunday
        if (interval.endMin > 10080) {
          intervals.push({ startMin: interval.startMin, endMin: 10080, source: day.dayOfWeek });
          intervals.push({ startMin: 0, endMin: interval.endMin - 10080, source: 'SATURDAY_OVERNIGHT_WRAP' });
        } else {
          intervals.push({ ...interval, source: day.dayOfWeek });
        }
      }
    }

    // Add previous schedule's boundary shift if it overlaps into Monday (day 1)
    // Actually, effective boundaries can start on ANY day, not just Monday.
    // The prompt says: "Check effective-schedule boundary. Old schedule Sunday 22:00-06:00. New Monday 02:00-10:00 -> Overlaps".
    // We handle effective boundaries by explicitly passing the previous day's overnight shift into this validator, mapped to its logical position.
    
    // Check for any internal overlaps
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        if (this.doIntervalsOverlap(intervals[i], intervals[j])) {
          return {
            isValid: false,
            error: `Overlapping shifts detected between ${intervals[i].source} and ${intervals[j].source}.`
          };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Validates boundary between old schedule and new schedule.
   * `previousDayOvernightShift` is a shift from yesterday that crosses midnight into today.
   * `todayShifts` are the shifts scheduled for today.
   */
  static validateBoundaryOverlap(
    previousDayOvernightShift: { startTime: string; endTime: string },
    todayShifts: { startTime: string; endTime: string }[]
  ) {
    const prevEndMin = this.parseTime(previousDayOvernightShift.endTime); // Time it ends today
    
    for (const shift of todayShifts) {
      const todayStartMin = this.parseTime(shift.startTime);
      // It overlaps if today's shift starts strictly BEFORE the previous overnight shift ends.
      // E.g., prev ends at 06:00. today starts at 02:00. 02:00 < 06:00 -> OVERLAP.
      // E.g., prev ends at 06:00. today starts at 06:00. 06:00 < 06:00 -> FALSE (Allowed).
      if (todayStartMin < prevEndMin) {
        return {
          isValid: false,
          error: `Effective schedule boundary overlap. Previous day's overnight shift ends at ${previousDayOvernightShift.endTime}, but new schedule starts today at ${shift.startTime}.`
        };
      }
    }

    return { isValid: true };
  }
}
