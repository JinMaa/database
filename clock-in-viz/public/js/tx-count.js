document.addEventListener('DOMContentLoaded', function() {
  // Fetch transaction count data
  fetch('/api/tx-count-data')
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        renderVisualization(result.data);
        populateTable(result.data.blockData);
      } else {
        showError(result.error || 'An error occurred while fetching data');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('Failed to fetch data. Please try again later.');
    });
  
  function renderVisualization(data) {
    const { blockData, globalMaxTxCount } = data;
    
    // Hide loading indicator and show visualization container
    document.getElementById('loading').style.display = 'none';
    document.getElementById('visualization-container').style.display = 'block';
    
    // Clear previous visualization
    const container = d3.select('#block-visualization');
    container.html('');
    
    // Set up SVG dimensions to use full width
    const margin = { top: 50, right: 150, bottom: 80, left: 80 };
    const containerWidth = document.getElementById('block-visualization').clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = container.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create X scale for block heights
    const x = d3.scaleBand()
      .domain(blockData.map(d => d.height))
      .range([0, width])
      .padding(0.2);
    
    // Create Y scale for transaction count
    const y = d3.scaleLinear()
      .domain([0, globalMaxTxCount * 1.1]) // Add 10% for visualization margin
      .range([height, 0]);
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('padding', '10px')
      .style('pointer-events', 'none');
    
    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(y));
    
    // Add X axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .text('Block Height');
    
    // Add Y axis label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -height / 2)
      .text('Transaction Count');
    
    // Add title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('font-size', '20px')
      .attr('font-weight', 'bold')
      .text('Clock-In Percentage by Height');
    
    // Prepare data for stacked bars
    const stackData = [];
    
    blockData.forEach(block => {
      const clockInCount = block.transactions.length;
      const otherTxCount = (block.txCount || 0) - clockInCount;
      
      // Add data for stacked bar chart
      stackData.push({
        blockHeight: block.height,
        type: 'Other',
        count: otherTxCount,
        maxClockIn: block.maxClockIn,
        total: block.txCount || 0,
        percentage: 100 - (block.clockInPercentage || 0)
      });
      
      stackData.push({
        blockHeight: block.height,
        type: 'Clock-In',
        count: clockInCount,
        maxClockIn: block.maxClockIn,
        total: block.txCount || 0,
        percentage: block.clockInPercentage || 0
      });
    });
    
    // Group data by block height for stacking
    const nestedData = d3.group(stackData, d => d.blockHeight);
    
    // Define stack generator
    const stackGenerator = d3.stack()
      .keys(['Other', 'Clock-In'])
      .value((group, key) => {
        const item = group[1].find(d => d.type === key);
        return item ? item.count : 0;
      });
    
    // Color scale for the stacked bars
    const colorScale = d3.scaleOrdinal()
      .domain(['Other', 'Clock-In'])
      .range(['#6c757d', '#FF9900']);
    
    // Process data for stacking
    const stackedSeries = [];
    
    nestedData.forEach((values, blockHeight) => {
      const otherTx = values.find(d => d.type === 'Other');
      const clockIn = values.find(d => d.type === 'Clock-In');
      
      // Draw the stacked bar
      if (otherTx && clockIn) {
        const total = otherTx.total;
        
        // Draw other transactions (top part)
        svg.append('rect')
          .attr('x', x(parseInt(blockHeight)))
          .attr('y', y(total))
          .attr('width', x.bandwidth())
          .attr('height', height - y(otherTx.count))
          .attr('fill', '#6c757d')
          .attr('opacity', 0.8)
          .on('mouseover', function(event) {
            d3.select(this).attr('opacity', 1);
            tooltip.transition()
              .duration(200)
              .style('opacity', .9);
            tooltip.html(`
              <strong>Block Height:</strong> ${blockHeight}<br>
              <strong>Total Transactions:</strong> ${total}<br>
              <strong>Other:</strong> ${otherTx.count}<br>
              <strong>Percentage:</strong> ${otherTx.percentage.toFixed(2)}%
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition()
              .duration(500)
              .style('opacity', 0);
          });
        
        // Draw clock-in transactions (bottom part)
        if (clockIn.count > 0) {
          svg.append('rect')
            .attr('x', x(parseInt(blockHeight)))
            .attr('y', y(clockIn.count))
            .attr('width', x.bandwidth())
            .attr('height', height - y(clockIn.count))
            .attr('fill', '#FF9900')
            .attr('opacity', 0.9)
            .attr('stroke', '#E68A00')
            .attr('stroke-width', 1)
            .on('mouseover', function(event) {
              d3.select(this).attr('opacity', 1);
              tooltip.transition()
                .duration(200)
                .style('opacity', .9);
              tooltip.html(`
                <strong>Block Height:</strong> ${blockHeight}<br>
                <strong>Clock-In:</strong> ${clockIn.count}<br>
                <strong>Max Clock-In Count:</strong> ${clockIn.maxClockIn}<br>
                <strong>Percentage:</strong> ${clockIn.percentage.toFixed(2)}%
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
              d3.select(this).attr('opacity', 0.9);
              tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            });
          
          // Add percentage label inside the clock-in portion if there's enough space
          if (clockIn.percentage > 5) {
            svg.append('text')
              .attr('x', x(parseInt(blockHeight)) + x.bandwidth() / 2)
              .attr('y', y(clockIn.count / 2))
              .attr('text-anchor', 'middle')
              .attr('fill', 'white')
              .attr('font-weight', 'bold')
              .attr('font-size', '10px')
              .text(`${clockIn.percentage.toFixed(1)}% (${clockIn.count})`);
          }
        }
        
        // Add total count above the bar
        svg.append('text')
          .attr('x', x(parseInt(blockHeight)) + x.bandwidth() / 2)
          .attr('y', y(total) - 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .text(total);
      }
    });
    
    // Add legend with border
    const legend = svg.append('g')
      .attr('transform', `translate(${width + 20}, 20)`);
    
    // Add background rectangle for legend
    legend.append('rect')
      .attr('width', 140)
      .attr('height', 70)
      .attr('fill', 'white')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1)
      .attr('rx', 5)  // Rounded corners
      .attr('ry', 5);
    
    // Add legend title
    legend.append('text')
      .attr('x', 10)
      .attr('y', 20)
      .attr('font-weight', 'bold')
      .text('Legend');
    
    // Add legend items
    const legendItems = [
      { name: 'Clock-In', color: '#FF9900' },
      { name: 'Other', color: '#6c757d' }
    ];
    
    legendItems.forEach((item, i) => {
      const legendGroup = legend.append('g')
        .attr('transform', `translate(10, ${i * 20 + 30})`);
      
      legendGroup.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', item.color)
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);
      
      legendGroup.append('text')
        .attr('x', 25)
        .attr('y', 12)
        .attr('font-size', '12px')
        .text(item.name);
    });
  }
  
  function populateTable(blockData) {
    const tableBody = document.querySelector('#data-table tbody');
    tableBody.innerHTML = '';
    
    blockData.forEach(block => {
      const row = document.createElement('tr');
      const clockInCount = block.transactions.length;
      
      row.innerHTML = `
        <td>${block.height}</td>
        <td>${block.txCount || 0}</td>
        <td>${clockInCount}</td>
        <td>${block.clockInPercentage ? block.clockInPercentage.toFixed(2) : 0}%</td>
        <td>${block.maxClockIn}</td>
      `;
      
      tableBody.appendChild(row);
    });
  }
  
  function showError(message) {
    document.getElementById('loading').style.display = 'none';
    
    const container = document.getElementById('visualization-container');
    container.style.display = 'block';
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <h4 class="alert-heading">Error</h4>
        <p>${message}</p>
      </div>
    `;
  }
});
