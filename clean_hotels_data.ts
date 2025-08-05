import * as fs from 'fs';
import type { AvailabilityResponse } from './hotels_types';

// Function to recursively remove properties from any object
export function removePropRecursively(obj: any, keyMatches: string[]): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removePropRecursively(item, keyMatches));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if any of the keyMatches strings are found in the key (case insensitive)
    const shouldSkip = keyMatches.some((match) =>
      key.toLowerCase().includes(match.toLowerCase())
    );

    if (shouldSkip) {
      continue;
    }
    cleaned[key] = removePropRecursively(value, keyMatches);
  }
  return cleaned;
}

export function filterByAllowlist(data: any, allowlist: string[]): any {
  /**
   * This is the internal recursive function that does the actual work.
   * It includes a flag `isAncestorAllowlisted` to track if we are currently inside a branch
   * that has already been approved for keeping.
   *
   * @param currentData The data at the current level of recursion.
   * @param isAncestorAllowlisted True if a parent key was on the allowlist.
   * @returns The filtered data, or null if nothing from this branch should be kept.
   */
  function recursiveFilter(
    currentData: any,
    isAncestorAllowlisted: boolean
  ): any {
    // If a parent was on the allowlist, we keep this entire branch without further checks.
    if (isAncestorAllowlisted) {
      return currentData;
    }

    // Primitives (string, number, etc.) cannot contain allowlisted keys themselves.
    // So, if we are here and a parent wasn't allowlisted, this path is a dead end.
    if (currentData === null || typeof currentData !== 'object') {
      return null;
    }

    // --- Handle Arrays ---
    if (Array.isArray(currentData)) {
      const newArray = currentData
        .map((item) => recursiveFilter(item, false)) // Process each item
        .filter((item) => item !== null); // Remove items that were filtered out

      // If the array is empty after filtering, it's a dead end.
      return newArray.length > 0 ? newArray : null;
    }

    // --- Handle Objects ---
    const newObj: { [key: string]: any } = {};
    let hasContent = false;

    for (const key in currentData) {
      if (Object.prototype.hasOwnProperty.call(currentData, key)) {
        const value = currentData[key];
        const isKeyAllowlisted = allowlist.includes(key);

        // Recurse into the value. The `isAncestorAllowlisted` flag is true if EITHER
        // the current key is allowlisted OR a higher-level ancestor was.
        const filteredValue = recursiveFilter(value, isKeyAllowlisted);

        // If the recursive call returned something, it means a valid path was found.
        if (filteredValue !== null) {
          newObj[key] = filteredValue;
          hasContent = true;
        }
      }
    }

    // If the object is empty after filtering all its keys, it's a dead end.
    return hasContent ? newObj : null;
  }

  // Start the process.
  return recursiveFilter(data, false);
}

// function processHotelData(filePath: string) {
//   try {
//     // Read the original JSON file
//     const rawData = fs.readFileSync(filePath, 'utf8');
//     const hotelData: AvailabilityResponse = JSON.parse(rawData);
//
//     console.log(`Loaded ${hotelData.availability?.length} hotels`);
//
//     // Remove all image and rate data recursively
//     const cleanedData = filterByAllowlist(hotelData, [
//       'cancel_penalties',
//       'nonrefundable_date_ranges',
//       'propertyName',
//       'propertyId',
//     ]);
//
//     // Write the cleaned data to a new file
//     fs.writeFileSync(
//       `cleaned_${filePath}`,
//       JSON.stringify(cleanedData, null, 2),
//     );
//
//     console.log(`Cleaned data written to hotels_availability_res_cleaned.json`);
//     console.log(
//       `Removed all image and rate data from ${cleanedData.availability.length} hotels`,
//     );
//
//     // Display some sample data to verify images are gone
//     console.log('\nSample cleaned hotel (first hotel):');
//     const sampleHotel = cleanedData.availability[0];
//     console.log(JSON.stringify(sampleHotel, null, 2));
//   } catch (error) {
//     console.error('Error processing hotel data:', error);
//   }
// }
//
// // Run the processing
// processHotelData('hotels_availability_res.json');
